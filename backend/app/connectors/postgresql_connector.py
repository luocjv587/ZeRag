from typing import List, Dict, Any, Optional
import psycopg2
import psycopg2.extras
from app.connectors.base import BaseConnector


class PostgreSQLConnector(BaseConnector):
    def __init__(self, host: str, port: int, database: str, username: str, password: str):
        self.host = host
        self.port = port
        self.database = database
        self.username = username
        self.password = password
        self._conn = None

    def connect(self) -> None:
        self._conn = psycopg2.connect(
            host=self.host,
            port=self.port,
            dbname=self.database,
            user=self.username,
            password=self.password,
        )

    def test_connection(self) -> bool:
        try:
            self.connect()
            return True
        except Exception:
            return False
        finally:
            self.close()

    def get_tables(self) -> List[str]:
        with self._conn.cursor() as cursor:
            cursor.execute(
                "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
            )
            return [row[0] for row in cursor.fetchall()]

    def get_columns(self, table_name: str) -> List[str]:
        with self._conn.cursor() as cursor:
            cursor.execute(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = %s AND table_schema = 'public'",
                (table_name,),
            )
            return [row[0] for row in cursor.fetchall()]

    def fetch_all_rows(self, table_name: str, columns: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        cols = ", ".join([f'"{c}"' for c in columns]) if columns else "*"
        with self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            cursor.execute(f'SELECT {cols} FROM "{table_name}"')
            return [dict(row) for row in cursor.fetchall()]

    def close(self) -> None:
        if self._conn:
            self._conn.close()
            self._conn = None
