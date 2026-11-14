const { config } = require("./index");

function getSupabaseConfig() {
    return config.supabase;
}

module.exports = { getSupabaseConfig };
