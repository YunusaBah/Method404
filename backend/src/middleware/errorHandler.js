const { ApiError } = require("./apiError");

function errorHandler(error, req, res, next) {
    if (res.headersSent) {
        return next(error);
    }

    const isApiError = error instanceof ApiError;
    const isCorsError = error.message === "Origin is not allowed by CORS.";
    const isBodyParseError = error instanceof SyntaxError && error.status === 400 && "body" in error;
    const statusCode = isApiError ? error.statusCode : isCorsError ? 403 : isBodyParseError ? 400 : 500;
    const code = isApiError
        ? error.code
        : isCorsError
            ? "CORS_ORIGIN_DENIED"
            : isBodyParseError
                ? "INVALID_JSON"
                : "INTERNAL_SERVER_ERROR";
    const message = isApiError
        ? error.message
        : isCorsError
            ? "This origin is not allowed."
            : isBodyParseError
                ? "Request body must contain valid JSON."
                : "An unexpected server error occurred.";

    if (statusCode >= 500) {
        console.error(error);
    }

    return res.status(statusCode).json({
        success: false,
        error: { code, message },
        message
    });
}

module.exports = errorHandler;
