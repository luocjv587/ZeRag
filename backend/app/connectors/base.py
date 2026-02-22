from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional


class BaseConnector(ABC):
    """数据源连接器基类"""

    @abstractmethod
    def connect(self) -> None:
        """建立连接"""
        pass

    @abstractmethod
    def test_connection(self) -> bool:
        """测试连接是否可用"""
        pass

    @abstractmethod
    def get_tables(self) -> List[str]:
        """获取所有表名"""
        pass

    @abstractmethod
    def get_columns(self, table_name: str) -> List[str]:
        """获取指定表的列名"""
        pass

    @abstractmethod
    def fetch_all_rows(self, table_name: str, columns: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """拉取指定表的所有数据"""
        pass

    @abstractmethod
    def close(self) -> None:
        """关闭连接"""
        pass

    def __enter__(self):
        self.connect()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
