from typing import List, Dict, Any, Optional
import pymysql
import pymysql.cursors
from app.connectors.base import BaseConnector


class MySQLConnector(BaseConnector):
    def __init__(self, host: str, port: int, database: str, username: str, password: str):
        self.host = host
        self.port = port
        self.database = database
        self.username = username
        self.password = password
        self._conn = None

    def connect(self) -> None:
        self._conn = pymysql.connect(
            host=self.host,
            port=self.port,
            user=self.username,
            password=self.password,
            database=self.database,
            charset="utf8mb4",
            cursorclass=pymysql.cursors.DictCursor,
        )

    def test_connection(self) -> bool:
        try:
            self.connect()
            self._conn.ping()
            return True
        except Exception:
            return False
        finally:
            self.close()

    def get_tables(self) -> List[str]:
        with self._conn.cursor() as cursor:
            cursor.execute("SHOW TABLES")
            rows = cursor.fetchall()
            return [list(row.values())[0] for row in rows]

    def get_columns(self, table_name: str) -> List[str]:
        with self._conn.cursor() as cursor:
            cursor.execute(f"DESCRIBE `{table_name}`")
            rows = cursor.fetchall()
            return [row["Field"] for row in rows]

    def fetch_all_rows(self, table_name: str, columns: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        cols = ", ".join([f"`{c}`" for c in columns]) if columns else "*"
        with self._conn.cursor() as cursor:
            cursor.execute(f"SELECT {cols} FROM `{table_name}`")
            return cursor.fetchall()

    def close(self) -> None:
        if self._conn:
            self._conn.close()
            self._conn = None
