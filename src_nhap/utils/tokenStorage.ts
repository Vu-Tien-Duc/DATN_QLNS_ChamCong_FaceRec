// const ACCESS_TOKEN = "crm_access_token";
// const REFRESH_TOKEN = "crm_refresh_token";
// const USER = "crm_user";

// export const tokenStorage = {

//   getAccessToken() {
//     return localStorage.getItem(ACCESS_TOKEN);
//   },

//   setAccessToken(token: string) {
//     localStorage.setItem(ACCESS_TOKEN, token);
//   },

//   getRefreshToken() {
//     return localStorage.getItem(REFRESH_TOKEN);
//   },

//   setRefreshToken(token: string) {
//     localStorage.setItem(REFRESH_TOKEN, token);
//   },

//   getUser() {
//     const user = localStorage.getItem(USER);
//     return user ? JSON.parse(user) : null;
//   },

//   setUser(user: any) {
//     localStorage.setItem(USER, JSON.stringify(user));
//   },

//   clear() {
//     localStorage.removeItem(ACCESS_TOKEN);
//     localStorage.removeItem(REFRESH_TOKEN);
//     localStorage.removeItem(USER);
//   }

// };



export const tokenStorage = {

  getAccessToken() {
    return localStorage.getItem("crm_access_token");
  },

  setAccessToken(token: string) {
    localStorage.setItem("crm_access_token", token);
  },

    setRefreshToken(token: string) {
    localStorage.setItem("crm_refresh_token", token);
  },

    getRefreshToken() {
    return localStorage.getItem("crm_refresh_token");
  },

  getUser() {

    const user = localStorage.getItem("crm_user");

    if (!user || user === "undefined") {
      return null;
    }

    try {
      return JSON.parse(user);
    } catch {
      return null;
    }

  },

  setUser(user: any) {
    localStorage.setItem("crm_user", JSON.stringify(user));
  },

  clear() {
    localStorage.removeItem("crm_access_token");
    localStorage.removeItem("crm_refresh_token");
    localStorage.removeItem("crm_user");
  },

  removeAccessToken() {
    localStorage.removeItem("crm_access_token");
  },

  removeRefreshToken() {
    localStorage.removeItem("crm_refresh_token");
  }

};