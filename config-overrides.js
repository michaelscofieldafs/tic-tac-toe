module.exports = function override(config) {
    // Localiza todas as regras que usam source-map-loader
    config.module.rules = config.module.rules.map(rule => {
        if (rule.use && rule.use.some(u => u.loader && u.loader.includes("source-map-loader"))) {
            return {
                ...rule,
                exclude: [
                    /node_modules\/@reown/,
                    /node_modules\/@walletconnect/,
                    /node_modules\/superstruct/,
                    /node_modules/
                ]
            };
        }
        return rule;
    });

    return config;
};
