import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv

load_dotenv(Path(__file__).with_name(".env"), override=False)


@dataclass(frozen=True)
class Settings:
    nasa_power_base_url: str
    nasa_request_timeout_seconds: float


def load_settings() -> Settings:
    base_url = os.getenv(
        "NASA_POWER_BASE_URL",
        "https://power.larc.nasa.gov/api/temporal/daily/point",
    )
    parsed_url = urlparse(base_url)
    if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
        raise ValueError("NASA_POWER_BASE_URL must be a valid HTTP(S) URL.")

    try:
        timeout = float(os.getenv("NASA_REQUEST_TIMEOUT_SECONDS", "15"))
    except ValueError as error:
        raise ValueError("NASA_REQUEST_TIMEOUT_SECONDS must be a positive number.") from error
    if timeout <= 0:
        raise ValueError("NASA_REQUEST_TIMEOUT_SECONDS must be a positive number.")

    return Settings(
        nasa_power_base_url=base_url,
        nasa_request_timeout_seconds=timeout,
    )


settings = load_settings()
