/** @type {import('expo/config').ExpoConfig} */
module.exports = ({ config }) => {
  const origin = process.env.FRONTEND_ORIGIN?.replace(/\/+$/, "");
  if (!origin) {
    throw new Error("FRONTEND_ORIGIN is required (set in root .env)");
  }

  return {
    ...config,
    expo: {
      ...config.expo,
      plugins: [
        ["expo-router", { origin }],
        "expo-font",
        "expo-web-browser",
      ],
    },
  };
};
