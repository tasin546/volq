const express = require("express");
const router = express.Router();
const Docker = require("dockerode");
const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");
const CatLoggr = require("cat-loggr");
const log = new CatLoggr();
const https = require("https");
const { pullImage } = require("../handlers/seed");
const { pipeline } = require("stream/promises");
const statedirectory = path.resolve(__dirname, "../states.json");
const docker = new Docker({ socketPath: process.env.dockerSocket || "/var/run/docker.sock" });

// Ensure states file exists and is valid
async function ensureStatesFile() {
  try {
    if (!fsSync.existsSync(statedirectory)) {
      await fs.writeFile(statedirectory, JSON.stringify([], null, 2));
    } else {
      // Validate existing file
      const content = await fs.readFile(statedirectory, "utf-8");
      JSON.parse(content); // Will throw if invalid JSON
    }
  } catch (error) {
    log.error("Error ensuring states file:", error);
    throw error;
  }
}

async function setStateValue(id, state) {
  await ensureStatesFile();
  const data = JSON.parse(await fs.readFile(statedirectory, "utf-8"));

  const item = data.find((entry) => entry.Id === id);
  if (!item) {
    throw new Error(`ID ${id} not found.`);
  }

  item.State = state;
  await fs.writeFile(statedirectory, JSON.stringify(data, null, 2));
  log.info(`State updated for ${id} to ${state}`);
}

async function setState(id, state) {
  try {
    await ensureStatesFile();
    const data = JSON.parse(await fs.readFile(statedirectory, "utf-8"));

    // Remove existing entry if it exists
    const newData = data.filter(entry => entry.Id !== id);
    newData.push({ Id: id, State: state });

    await fs.writeFile(statedirectory, JSON.stringify(newData, null, 2));
    log.info(`State set successfully for ${id} to ${state}`);
  } catch (error) {
    log.error("Error setting state:", error);
    throw error;
  }
}

async function getState(id) {
  await ensureStatesFile();
  const data = JSON.parse(await fs.readFile(statedirectory, "utf-8"));
  const item = data.find((entry) => entry.Id === id);
  return item ? item.State : null;
}

const downloadFile = async (url, dir, filename) => {
  const filePath = path.join(dir, filename);
  const tempPath = `${filePath}.tmp`;

  return new Promise((resolve, reject) => {
    https.get(url, async (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${filename}: HTTP status code ${response.statusCode}`));
        return;
      }

      try {
        const writeStream = fsSync.createWriteStream(tempPath);
        await pipeline(response, writeStream);
        
        // Rename temp file to final filename after successful download
        await fs.rename(tempPath, filePath);
        resolve();
      } catch (err) {
        // Clean up temp file if there was an error
        if (fsSync.existsSync(tempPath)) {
          await fs.unlink(tempPath).catch(() => {});
        }
        reject(err);
      }
    }).on("error", (err) => {
      reject(err);
    });
  });
};

const downloadInstallScripts = async (installScripts, dir, variables) => {
  try {
    if (!fsSync.existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }

    const parsedVariables = typeof variables === "string" ? JSON.parse(variables) : variables || {};
    
    const downloadPromises = installScripts.map(async (script) => {
      try {
        let updatedUri = script.Uri;

        for (const [key, value] of Object.entries(parsedVariables)) {
          updatedUri = updatedUri.replace(new RegExp(`{{${key}}}`, "g"), value);
        }

        await downloadFile(updatedUri, dir, script.Path);
        log.info(`Successfully downloaded ${script.Path}`);
        return { success: true, script: script.Path };
      } catch (err) {
        log.error(`Failed to download ${script.Path}: ${err.message}`);
        return { success: false, script: script.Path, error: err.message };
      }
    });

    const results = await Promise.all(downloadPromises);
    const failedDownloads = results.filter(r => !r.success);
    
    if (failedDownloads.length > 0) {
      throw new Error(`Failed to download ${failedDownloads.length} scripts`);
    }
  } catch (err) {
    log.error(`Error in downloadInstallScripts: ${err.message}`);
    throw err;
  }
};

const replaceVariables = async (dir, variables) => {
  try {
    const files = await fs.readdir(dir);
    
    const replacePromises = files.map(async (file) => {
      const filePath = path.join(dir, file);
      const stats = await fs.stat(filePath);
      
      if (stats.isFile() && !file.endsWith(".jar")) {
        try {
          let content = await fs.readFile(filePath, "utf8");
          let changesMade = false;
          
          for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`{{${key}}}`, "g");
            if (regex.test(content)) {
              content = content.replace(regex, value);
              changesMade = true;
            }
          }
          
          if (changesMade) {
            await fs.writeFile(filePath, content, "utf8");
            log.info(`Variables replaced in ${file}`);
          }
        } catch (err) {
          log.error(`Error processing file ${file}: ${err.message}`);
        }
      }
    });

    await Promise.all(replacePromises);
  } catch (err) {
    log.error(`Error in replaceVariables: ${err.message}`);
    throw err;
  }
};

// State management endpoints
router.get("/:id/states/set/:state", async (req, res) => {
  const { id, state } = req.params;

  try {
    await setStateValue(id, state);
    res.json({ success: true, message: `State updated for ID ${id}` });
  } catch (error) {
    log.error("Error updating state:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

router.get("/:id/states/get", async (req, res) => {
  const { id } = req.params;
  try {
    const state = await getState(id);
    if (state === null) {
      return res.status(404).json({ error: `ID ${id} not found.` });
    }
    res.json({ success: true, state });
  } catch (error) {
    log.error("Error getting state:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Container management endpoints
router.post("/create", async (req, res) => {
  log.info("Deployment in progress...");
  const { Image, Id, Cmd, Env, Ports, Scripts, Memory, Cpu, PortBindings } = req.body;
  const variables2 = req.body.variables;

  if (!Image || !Id) {
    return res.status(400).json({ message: "Image and Id are required" });
  }

  try {
    // Set initial state
    await setState(Id, "PULLING_IMAGE");

    // Pull the Docker image
    await pullImage(Image);
    await setState(Id, "CREATING_VOLUME");

    // Create volume directory
    const volumePath = path.join(__dirname, "../volumes", Id);
    await fs.mkdir(volumePath, { recursive: true });

    const primaryPort = PortBindings ? Object.values(PortBindings)[0]?.[0]?.HostPort : null;

    function objectToEnv(obj) {
      return obj ? Object.entries(obj).map(([key, value]) => `${key}=${value}`) : [];
    }
    
    const variables2Env = objectToEnv(typeof variables2 === "string" ? JSON.parse(variables2) : variables2);

    const environmentVariables = [
      ...(Array.isArray(Env) ? Env : []),
      ...variables2Env,
      ...(primaryPort ? [`PRIMARY_PORT=${primaryPort}`] : []),
      ...(Memory ? [`INSTANCE_MEMORY=${Memory}`] : []),
      ...(Cpu ? [`INSTANCE_CPU=${Cpu}`] : []),
      `INSTANCE_ID=${Id}`,
    ].filter(Boolean);

    const containerOptions = {
      name: Id,
      Image,
      ExposedPorts: Ports || {},
      AttachStdout: true,
      AttachStderr: true,
      AttachStdin: true,
      Tty: true,
      OpenStdin: true,
      HostConfig: {
        PortBindings: PortBindings || {},
        Binds: [`${volumePath}:/app/data`],
        ...(Memory && { Memory: Memory * 1024 * 1024 }),
        ...(Cpu && { CpuCount: Cpu }),
        NetworkMode: "host",
      },
      Env: environmentVariables,
    };

    if (Cmd) containerOptions.Cmd = Cmd;

    await setState(Id, "CREATING_CONTAINER");
    const container = await docker.createContainer(containerOptions);
    
    res.status(201).json({
      message: "Container and volume created successfully",
      containerId: container.id,
      volumeId: Id,
      state: "INSTALLING",
      Env: environmentVariables,
    });

    // Proceed with installation scripts if they exist
    if (Scripts?.Install?.length) {
      await setState(Id, "INSTALLING");
      try {
        const dir = path.join(__dirname, "../volumes", Id);
        await downloadInstallScripts(Scripts.Install, dir, variables2);

        const variables = {
          ...(primaryPort && { primaryPort }),
          containerName: container.id.substring(0, 12),
          timestamp: new Date().toISOString(),
          randomString: Math.random().toString(36).substring(7),
        };

        await replaceVariables(dir, variables);
      } catch (err) {
        log.error("Error during installation:", err);
        await setStateValue(Id, "INSTALLATION_FAILED");
        return;
      }
    }

    await setState(Id, "STARTING");
    await container.start();
    await setStateValue(Id, "RUNNING");
  } catch (err) {
    log.error("Deployment failed:", err);
    await setStateValue(Id, "FAILED");
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    const info = await container.inspect();
    
    // Stop container if running
    if (info.State.Running) {
      await container.stop();
    }
    
    // Remove container
    await container.remove();
    
    // Clean up state
    await setStateValue(req.params.id, "DELETED");
    
    res.status(200).json({ message: "Container removed successfully" });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ message: "Container not found" });
    }
    log.error("Error removing container:", err);
    res.status(500).json({ message: err.message });
  }
});

router.post("/redeploy/:id", async (req, res) => {
  const { id } = req.params;
  
  try {
    const container = docker.getContainer(id);
    const info = await container.inspect();
    
    if (info.State.Running) {
      await container.stop();
    }
    await container.remove();

    const { Image, Id, Ports, Memory, Cpu, PortBindings, Env } = req.body;
    if (!Image || !Id) {
      throw new Error("Image and Id are required");
    }

    const volumePath = path.join(__dirname, "../volumes", Id);
    if (!fsSync.existsSync(volumePath)) {
      throw new Error(`Volume directory not found for ${Id}`);
    }

    const containerOptions = {
      name: Id,
      Image,
      ExposedPorts: Ports || {},
      AttachStdout: true,
      AttachStderr: true,
      AttachStdin: true,
      Tty: true,
      OpenStdin: true,
      HostConfig: {
        PortBindings: PortBindings || {},
        Binds: [`${volumePath}:/app/data`],
        ...(Memory && { Memory: Memory * 1024 * 1024 }),
        ...(Cpu && { CpuCount: Cpu }),
        NetworkMode: "host",
      },
      Env: Array.isArray(Env) ? Env : [],
    };

    const newContainer = await docker.createContainer(containerOptions);
    await newContainer.start();
    
    res.status(200).json({
      message: "Container redeployed successfully",
      containerId: newContainer.id,
    });
  } catch (err) {
    log.error("Error redeploying container:", err);
    res.status(500).json({ message: err.message });
  }
});

router.post("/reinstall/:id", async (req, res) => {
  const { id } = req.params;
  
  try {
    const container = docker.getContainer(id);
    const info = await container.inspect();
    
    if (info.State.Running) {
      await container.stop();
    }
    await container.remove();

    const { Image, Id, Ports, Memory, Cpu, PortBindings, Env, imageData } = req.body;
    if (!Image || !Id) {
      throw new Error("Image and Id are required");
    }

    const volumePath = path.join(__dirname, "../volumes", Id);
    if (!fsSync.existsSync(volumePath)) {
      throw new Error(`Volume directory not found for ${Id}`);
    }

    const containerOptions = {
      name: Id,
      Image,
      ExposedPorts: Ports || {},
      AttachStdout: true,
      AttachStderr: true,
      AttachStdin: true,
      Tty: true,
      OpenStdin: true,
      HostConfig: {
        PortBindings: PortBindings || {},
        Binds: [`${volumePath}:/app/data`],
        ...(Memory && { Memory: Memory * 1024 * 1024 }),
        ...(Cpu && { CpuCount: Cpu }),
        NetworkMode: "host",
      },
      Env: Array.isArray(Env) ? Env : [],
    };

    const newContainer = await docker.createContainer(containerOptions);

    if (imageData?.Scripts?.Install?.length) {
      const dir = path.join(__dirname, "../volumes", Id);
      
      // Convert Env array to object
      const envObj = Env.reduce((acc, item) => {
        const [key, value] = item.split("=");
        acc[key] = value;
        return acc;
      }, {});

      await downloadInstallScripts(imageData.Scripts.Install, dir, envObj);

      const variables = {
        primaryPort: PortBindings ? Object.values(PortBindings)[0]?.[0]?.HostPort : null,
        containerName: newContainer.id.substring(0, 12),
        timestamp: new Date().toISOString(),
        randomString: Math.random().toString(36).substring(7),
      };
      
      await replaceVariables(dir, variables);
    }
    
    await newContainer.start();
    res.status(200).json({
      message: "Container reinstalled successfully",
      containerId: newContainer.id,
    });
  } catch (err) {
    log.error("Error reinstalling container:", err);
    res.status(500).json({ message: err.message });
  }
});

router.put("/edit/:id", async (req, res) => {
  const { id } = req.params;
  const { Image, Memory, Cpu, VolumeId } = req.body;

  if (!VolumeId) {
    return res.status(400).json({ message: "VolumeId is required" });
  }

  try {
    log.info(`Editing container: ${id}`);
    const container = docker.getContainer(id);
    const containerInfo = await container.inspect();
    
    if (containerInfo.State.Running) {
      await container.stop();
    }

    const existingConfig = containerInfo.Config;
    const existingHostConfig = containerInfo.HostConfig;
    
    const newContainerOptions = {
      name: containerInfo.Name.replace(/^\//, ""), // Remove leading slash from name
      Image: Image || existingConfig.Image,
      ExposedPorts: existingConfig.ExposedPorts || {},
      Cmd: existingConfig.Cmd,
      Env: existingConfig.Env || [],
      AttachStdout: true,
      AttachStderr: true,
      AttachStdin: true,
      Tty: true,
      OpenStdin: true,
      HostConfig: {
        PortBindings: existingHostConfig.PortBindings || {},
        Binds: [`${path.join(__dirname, "../volumes", VolumeId)}:/app/data`],
        ...(Memory !== undefined && { Memory: Memory * 1024 * 1024 }),
        ...(Cpu !== undefined && { CpuCount: Cpu }),
        NetworkMode: "host",
      },
    };

    await container.remove();
    const newContainer = await docker.createContainer(newContainerOptions);
    await newContainer.start();

    log.info(`Edit completed! New container ID: ${newContainer.id}`);
    res.status(200).json({
      message: "Container edited successfully",
      oldContainerId: id,
      newContainerId: newContainer.id,
    });
  } catch (err) {
    log.error(`Edit failed: ${err.message}`);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;