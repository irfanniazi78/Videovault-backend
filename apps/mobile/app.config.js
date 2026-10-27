const appJson = require("./app.json");

module.exports = () => {
  const apiUrl =
    process.env.EXPO_PUBLIC_API_URL ||
    appJson.expo.extra?.apiUrl ||
    "http://10.0.2.2:3000";

  return {
    ...appJson,
    expo: {
      ...appJson.expo,
      extra: {
        ...appJson.expo.extra,
        apiUrl,
      },
    },
  };
};
