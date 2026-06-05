from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import oracledb

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ConnectRequest(BaseModel):
    host: str
    port: str
    service: str
    user: str
    password: str


class FetchRequest(BaseModel):
    host: str
    port: str
    service: str
    user: str
    password: str
    procedure_name: str


def get_connection(req):
    return oracledb.connect(
        user=req.user,
        password=req.password,
        host=req.host,
        port=int(req.port),
        service_name=req.service,
    )


@app.post("/test-connection")
def test_connection(req: ConnectRequest):
    try:
        conn = get_connection(req)
        conn.close()
        return {"status": "ok", "message": "Connection successful!"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/get-parameters")
def get_parameters(req: FetchRequest):
    try:
        conn = get_connection(req)
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT argument_name, data_type, in_out, position
            FROM all_arguments
            WHERE object_name = :1
            ORDER BY position
        """,
            [req.procedure_name.upper()],
        )
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        if not rows:
            raise HTTPException(
                status_code=404,
                detail=f"Procedure '{req.procedure_name}' not found or no parameters.",
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


@app.post("/fetch-records")
def fetch_records(req: FetchRequest):
    try:
        conn = get_connection(req)
        cursor = conn.cursor()

        out_cursor = cursor.var(oracledb.CURSOR)
        cursor.callproc(req.procedure_name.upper(), [out_cursor])
        result_cursor = out_cursor.getvalue()

        if not result_cursor:
            raise HTTPException(status_code=404, detail="Procedure returned no cursor.")

        rows = result_cursor.fetchall()
        columns = [col[0] for col in result_cursor.description]

        cursor.close()
        conn.close()

        return {
            "status": "ok",
            "procedure": req.procedure_name.upper(),
            "total_rows": len(rows),
            "columns": columns,
            "rows": [list(r) for r in rows],
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
