"""
HyperGrid Casbin Logger — optional authorization logging.

Usage:
    logger = CasbinLogger(enabled=True, min_level="info")
    grid_engine = HyperGridJinjaEngine(enforcer, logger=logger)
"""

import json
import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional


class CasbinLogger:
    """Optional logger for Casbin authorization decisions.

    Supports multiple output handlers: file, stdout, stderr.
    Log levels: debug, info, notice, warning, error, critical.
    """

    LEVELS = {
        "debug": 0,
        "info": 1,
        "notice": 2,
        "warning": 3,
        "error": 4,
        "critical": 5,
    }

    def __init__(
        self,
        enabled: bool = False,
        min_level: str = "info",
        log_file: Optional[str] = None,
        handlers: Optional[list] = None,
    ):
        self.enabled = enabled
        self.min_level = self.LEVELS.get(min_level, 1)
        self.log_file = log_file or str(
            Path(Path.home(), ".hypergrid", "casbin.log")
        )
        self.handlers = handlers or ["file"]

        if self.enabled:
            log_dir = Path(self.log_file).parent
            log_dir.mkdir(parents=True, exist_ok=True)

        # Python stdlib logger as secondary output
        self._py_logger = logging.getLogger("hypergrid.casbin")
        self._py_logger.setLevel(logging.DEBUG if enabled else logging.WARNING)

    def _should_log(self, level: str) -> bool:
        return self.enabled and self.LEVELS.get(level, 0) >= self.min_level

    def _write(self, level: str, message: str, context: Optional[dict] = None):
        if not self._should_log(level):
            return

        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        ctx_str = ""
        if context:
            ctx_str = " " + json.dumps(context, default=str)
        entry = f"[{timestamp}] [hypergrid.casbin.{level}] {message}{ctx_str}\n"

        for handler in self.handlers:
            if handler == "file":
                try:
                    with open(self.log_file, "a", encoding="utf-8") as f:
                        f.write(entry)
                except OSError:
                    pass
            elif handler == "stdout":
                sys.stdout.write(entry)
                sys.stdout.flush()
            elif handler == "stderr":
                sys.stderr.write(entry)
                sys.stderr.flush()

        # Also pipe to stdlib logger
        log_method = getattr(self._py_logger, level, self._py_logger.info)
        log_method("%s %s", message, context or {})

    def debug(self, message: str, context: Optional[dict] = None):
        self._write("debug", message, context)

    def info(self, message: str, context: Optional[dict] = None):
        self._write("info", message, context)

    def warning(self, message: str, context: Optional[dict] = None):
        self._write("warning", message, context)

    def error(self, message: str, context: Optional[dict] = None):
        self._write("error", message, context)

    def critical(self, message: str, context: Optional[dict] = None):
        self._write("critical", message, context)

    def log_enforce(self, user_id: str, obj: str, action: str, allowed: bool):
        """Log an authorization enforcement decision."""
        level = "info" if allowed else "warning"
        self._write(
            level,
            "Enforce decision",
            {"user": user_id, "object": obj, "action": action, "allowed": allowed},
        )

    def log_cell_access(self, user_id: str, col_name: str, action: str, granted: bool):
        """Log a cell-level access check."""
        level = "debug" if granted else "warning"
        self._write(
            level,
            "Cell access check",
            {"user": user_id, "column": col_name, "action": action, "granted": granted},
        )
