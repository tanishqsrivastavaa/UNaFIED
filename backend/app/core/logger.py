import logging
import os
import sys

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()


def _get_logger(name: str = "unafied") -> logging.Logger:
    log = logging.getLogger(name)
    log.setLevel(getattr(logging, LOG_LEVEL, logging.INFO))

    if not log.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(getattr(logging, LOG_LEVEL, logging.INFO))
        formatter = logging.Formatter(
            fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)
        log.addHandler(handler)

    return log


logger = _get_logger()
