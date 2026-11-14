const { databaseService } = require("../src/services/databaseService");

function getConnectionGuidance(code) {
    if (code === "DATABASE_URL_MISSING") {
        return "Set DATABASE_URL in backend/.env.";
    }
    if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
        return "The database host could not be resolved. On IPv4-only networks, copy the Session pooler URI from Supabase Dashboard > Connect.";
    }
    if (code === "28P01") {
        return "PostgreSQL rejected authentication. Verify the database password and username in the Session pooler URI.";
    }
    if (code === "SELF_SIGNED_CERT_IN_CHAIN" || code === "CERT_HAS_EXPIRED") {
        return "TLS certificate verification failed. Check the network certificate chain; do not disable TLS verification.";
    }
    return "Check the database connection details and network access.";
}

databaseService.checkConnection()
    .then(() => {
        console.log("PostgreSQL connection verified.");
    })
    .catch((error) => {
        console.error(`${error.message} (${error.code}). ${getConnectionGuidance(error.code)}`);
        process.exitCode = 1;
    })
    .finally(() => databaseService.close());
