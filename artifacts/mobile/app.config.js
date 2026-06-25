/** @type {import('expo/config').ExpoConfig} */
module.exports = ({ config }) => {
  const origin = process.env.FRONTEND_ORIGIN?.replace(/\/+$/, "");
  if (!origin) {
    throw new Error("FRONTEND_ORIGIN is required (set in root .env)");
  }

  return {
    ...config,
    name: "LifeOps",
    expo: {
      ...config.expo,
      name: "LifeOps",
      plugins: [
        ["expo-router", { origin }],
        "expo-font",
        "expo-web-browser",
      ],
      web: {
        ...config.expo?.web,
        name: "LifeOps",
        shortName: "LifeOps",
        description: "Personal finance operations",
        themeColor: "#0A0A0F",
        backgroundColor: "#0A0A0F",
      },
    },
  };
};
