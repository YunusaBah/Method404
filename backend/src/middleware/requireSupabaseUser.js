const { databaseService } = require("../services/databaseService");
const { ApiError } = require("./apiError");

async function requireSupabaseUser(req, res, next) {
    const authorization = req.get("authorization");
    const match = typeof authorization === "string"
        ? authorization.match(/^Bearer\s+(\S+)$/i)
        : null;
    if (!match) {
        return next(new ApiError(
            401,
            "AUTHENTICATION_REQUIRED",
            "A Supabase access token is required."
        ));
    }

    try {
        const { client, user } = await databaseService.getAuthenticatedClient(match[1]);
        req.supabase = client;
        req.user = user;
        return next();
    } catch (error) {
        return next(error);
    }
}

module.exports = requireSupabaseUser;
