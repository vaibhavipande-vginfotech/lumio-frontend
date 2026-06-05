from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import oracledb

router = APIRouter()


class ConnectRequest(BaseModel):
    host: str
    port: str
    service: str
    user: str
    password: str


class InParam(BaseModel):
    name: str
    value: Optional[str] = ""
    position: int


class FetchRequest(BaseModel):
    host: str
    port: str
    service: str
    user: str
    password: str
    procedure_name: str
    in_params: List[InParam] = []


def get_connection(req, call_timeout_ms=30000):
    conn = oracledb.connect(
        user=req.user,
        password=req.password,
        host=req.host,
        port=int(req.port),
        service_name=req.service,
    )
    conn.callTimeout = call_timeout_ms  # max 30s per DB round-trip
    return conn


@router.post("/get-procedures")
def get_procedures(req: ConnectRequest):
    try:
        conn = get_connection(req)
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT object_name, object_type
            FROM all_objects
            WHERE owner = UPPER(:1)
            AND object_type IN ('PROCEDURE', 'FUNCTION')
            ORDER BY object_type, object_name
            """,
            [req.user],
        )
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        procedures = [{"name": row[0], "type": row[1]} for row in rows]
        return {"status": "ok", "procedures": procedures}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/test-connection")
def test_connection(req: ConnectRequest):
    try:
        conn = get_connection(req)
        conn.close()
        return {"status": "ok", "message": "Connection successful!"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/get-parameters")
def get_parameters(req: FetchRequest):
    try:
        conn = get_connection(req)
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT argument_name, data_type, in_out, position
            FROM all_arguments
            WHERE object_name = :1
              AND owner       = UPPER(:2)
            ORDER BY position
            """,
            [req.procedure_name.upper(), req.user],
        )
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        if not rows:
            raise HTTPException(
                status_code=404,
                detail=f"Procedure '{req.procedure_name}' not found or has no parameters.",
            )
        params = [
            {
                "name": row[0],
                "type": row[1] or "REF CURSOR",
                "direction": row[2],
                "position": row[3],
            }
            for row in rows
        ]
        return {"status": "ok", "parameters": params}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/fetch-records")
def fetch_records(req: FetchRequest):
    try:
        conn = get_connection(req)
        cursor = conn.cursor()

        # ── Step 1: fetch parameter metadata filtered by owner ────
        meta_cursor = conn.cursor()
        meta_cursor.execute(
            """
            SELECT argument_name, data_type, in_out, position
            FROM all_arguments
            WHERE object_name = :1
              AND owner       = UPPER(:2)
            ORDER BY position
            """,
            [req.procedure_name.upper(), req.user],
        )
        all_params = meta_cursor.fetchall()
        meta_cursor.close()

        print(f"[fetch-records] Procedure: {req.procedure_name}")
        print(f"[fetch-records] Params from DB ({len(all_params)} rows): {all_params}")

        # ── Step 2: build IN param lookup ────────────────────────
        in_param_map = {p.name.upper(): p.value for p in req.in_params}
        print(f"[fetch-records] IN params from frontend: {in_param_map}")

        # ── Step 3: build args list in position order ────────────
        result_var = None
        args = []

        DATE_FORMATS = ["%d/%m/%Y %H:%M:%S", "%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"]

        def parse_date(s):
            for fmt in DATE_FORMATS:
                try:
                    return datetime.strptime(s.strip(), fmt)
                except ValueError:
                    continue
            return None

        for param_name, data_type, in_out, position in all_params:
            if in_out == "OUT":
                if data_type == "REF CURSOR" or param_name is None:
                    var = cursor.var(oracledb.CURSOR)
                    if result_var is None:
                        result_var = var
                else:
                    var = cursor.var(str)
                args.append(var)
                print(f"  [{position}] {param_name} OUT {data_type} → var")
            else:
                raw = in_param_map.get(param_name.upper(), "") or ""
                if data_type in ("NUMBER", "INTEGER", "FLOAT"):
                    try:
                        val = float(raw) if raw else None
                    except ValueError:
                        val = None
                elif data_type == "DATE":
                    val = parse_date(raw) if raw else None
                else:
                    val = raw if raw else None
                args.append(val)
                print(f"  [{position}] {param_name} IN {data_type} → {repr(val)}")

        # Fallback if no metadata found
        if not args:
            print("[fetch-records] WARNING: no metadata found, using fallback [out_cursor]")
            result_var = cursor.var(oracledb.CURSOR)
            args = [result_var]

        print(f"[fetch-records] Calling callproc with {len(args)} args")

        # ── Step 4: call the procedure ───────────────────────────
        cursor.callproc(req.procedure_name.upper(), args)

        # ── Step 5: collect PO_ERROR if present ─────────────────
        po_error = None
        for i, (param_name, data_type, in_out, position) in enumerate(all_params):
            if in_out == "OUT" and data_type == "VARCHAR2":
                try:
                    po_error = args[i].getvalue()
                except Exception:
                    pass

        print(f"[fetch-records] PO_ERROR = {po_error}")

        if result_var is None:
            raise HTTPException(status_code=404, detail="No REF CURSOR OUT parameter found.")

        result_cursor = result_var.getvalue()
        if not result_cursor:
            detail = f"Procedure returned no cursor. PO_ERROR: {po_error}" if po_error else "Procedure returned no cursor."
            raise HTTPException(status_code=404, detail=detail)

        rows = result_cursor.fetchall()
        columns = [col[0] for col in result_cursor.description]

        print(f"[fetch-records] Success — {len(rows)} rows, columns: {columns}")

        cursor.close()
        conn.close()

        return {
            "status": "ok",
            "procedure": req.procedure_name.upper(),
            "total_rows": len(rows),
            "columns": columns,
            "rows": [list(r) for r in rows],
            "po_error": po_error,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[fetch-records] EXCEPTION: {e}")
        raise HTTPException(status_code=400, detail=str(e))
