const { databaseService } = require("../src/services/databaseService");

databaseService.checkConnection()
    .then(() => {
        console.log("Supabase connection and profiles table verified.");
    })
    .catch((error) => {
        console.error(`${error.message} (${error.code || "SUPABASE_UNAVAILABLE"}).`);
        process.exitCode = 1;
    });
