const express = require("express");
const axios = require("axios");
const { JSDOM } = require("jsdom");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const BASE_URL = "https://cargon.self.ge";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";

// ქუქიების მასივის სტრიქონად გარდაქმნა
const formatCookies = (cookiesArray) => {
  if (!cookiesArray) return "";
  return cookiesArray.map((c) => c.split(";")[0]).join("; ");
};

// DOM-იდან hidden ინპუტების ამოღების ფუნქცია
const extractHiddenInputs = (html) => {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const hiddenInputs = document.querySelectorAll("form#fform input[type='hidden']");

  const data = {};
  hiddenInputs.forEach((input) => {
    if (input.name) data[input.name] = input.value || "";
  });
  return data;
};

app.post("/api/auto-start", async (req, res) => {
  const { username, password, remember = "" } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required in POST body" });
  }

  try {
    // 1. GET Request: საწყისი ქუქიების და Login HTML-ის წამოღება
    const getLoginRes = await axios.get(`${BASE_URL}/?option=login`, {
      headers: { "User-Agent": USER_AGENT }
    });

    let currentCookies = formatCookies(getLoginRes.headers["set-cookie"]);
    const loginHiddenData = extractHiddenInputs(getLoginRes.data);

    // 2. POST Request: ავტორიზაცია
    const loginPayload = new URLSearchParams({
      ...loginHiddenData,
      task: "login",
      username,
      password,
      remember
    });

    const postLoginRes = await axios.post(`${BASE_URL}/?option=login`, loginPayload.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": currentCookies,
        "User-Agent": USER_AGENT,
        "Referer": `${BASE_URL}/?option=login`
      },
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400
    });

    if (postLoginRes.headers["set-cookie"]) {
      const newCookies = formatCookies(postLoginRes.headers["set-cookie"]);
      currentCookies = `${currentCookies}; ${newCookies}`;
    }

    // 3. GET Request: პროფილის გვერდიდან hidden ინპუტების ამოღება
    const getProfileRes = await axios.get(`${BASE_URL}/?option=profileedit`, {
      headers: {
        "Cookie": currentCookies,
        "User-Agent": USER_AGENT
      }
    });

    const profileHiddenData = extractHiddenInputs(getProfileRes.data);

    // 4. POST Request: "სამუშაოს დაწყება"
    const startWorkPayload = new URLSearchParams({
      ...profileHiddenData,
      option: "profileedit",
      task: "login"
    });

    const startWorkRes = await axios.post(`${BASE_URL}/?option=profileedit`, startWorkPayload.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": currentCookies,
        "User-Agent": USER_AGENT,
        "Referer": `${BASE_URL}/?option=profileedit`
      }
    });

    return res.status(200).json({
      success: true,
      message: "სამუშაოს დაწყება წარმატებით დაფიქსირდა!",
      status: startWorkRes.status
    });

  } catch (error) {
    console.error("Auto-start error:", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));