const express = require("express");
const router = express.Router();
const axios = require("axios");
const { db } = require("../../handlers/db.js");
const { isUserAuthorizedForContainer } = require("../../utils/authHelper");
const { loadPlugins } = require("../../plugins/loadPls.js");
const path = require("path");

const plugins = loadPlugins(path.join(__dirname, "../../plugins"));

router.get("/instance/:id/plugins", async (req, res) => {
  if (!req.user) return res.redirect("/");
  const { id } = req.params;
  const instance = await db.get(id + "_instance");
  if (!instance) return res.redirect("../instances");

  const isAuthorized = await isUserAuthorizedForContainer(req.user.userId, instance.Id);
  if (!isAuthorized) return res.status(403).send("Unauthorized access to this instance.");

  if (instance.suspended === true) return res.redirect("../../instances?err=SUSPENDED");

  const allPluginData = Object.values(plugins).map((p) => p.config);
  res.render("instance/plugin_manager", {
    req,
    user: req.user,
    instance,
    name: (await db.get("name")) || "VOLQ Panel",
    logo: (await db.get("logo")) || false,
    addons: { plugins: allPluginData },
  });
});

router.get("/instance/:id/plugins/list", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const { id } = req.params;
  const instance = await db.get(id + "_instance");
  if (!instance) return res.status(404).json({ error: "Instance not found" });

  const isAuthorized = await isUserAuthorizedForContainer(req.user.userId, instance.Id);
  if (!isAuthorized) return res.status(403).json({ error: "Unauthorized" });

  try {
    const response = await axios.get(
      `http://${instance.Node.address}:${instance.Node.port}/plugins/${instance.VolumeId}`,
      { auth: { username: "Volq", password: instance.Node.apiKey } }
    );
    res.json(response.data.plugins || []);
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.error || err.message });
  }
});

router.post("/instance/:id/plugins/install", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const { id } = req.params;
  const { url, filename } = req.body;
  const instance = await db.get(id + "_instance");
  if (!instance) return res.status(404).json({ error: "Instance not found" });

  const isAuthorized = await isUserAuthorizedForContainer(req.user.userId, instance.Id);
  if (!isAuthorized) return res.status(403).json({ error: "Unauthorized" });

  try {
    await axios.post(
      `http://${instance.Node.address}:${instance.Node.port}/plugins/${instance.VolumeId}/install`,
      { url, filename },
      { auth: { username: "Volq", password: instance.Node.apiKey } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.error || err.message });
  }
});

router.delete("/instance/:id/plugins/:filename", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const { id, filename } = req.params;
  const instance = await db.get(id + "_instance");
  if (!instance) return res.status(404).json({ error: "Instance not found" });

  const isAuthorized = await isUserAuthorizedForContainer(req.user.userId, instance.Id);
  if (!isAuthorized) return res.status(403).json({ error: "Unauthorized" });

  try {
    await axios.delete(
      `http://${instance.Node.address}:${instance.Node.port}/plugins/${instance.VolumeId}/${encodeURIComponent(filename)}`,
      { auth: { username: "Volq", password: instance.Node.apiKey } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.error || err.message });
  }
});

module.exports = router;
