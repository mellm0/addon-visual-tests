import type { Channel } from "@storybook/channels";
import { readConfig, writeConfig } from "@storybook/csf-tools";
import { StorybookConfig } from "@storybook/types";
import { exec } from "child_process";
// eslint-disable-next-line import/no-unresolved
import { run } from "chromatic/node";
import { promisify } from "util";

import {
  BUILD_STARTED,
  READ_PROJECT,
  RESPOND_PROJECT,
  START_BUILD,
  UPDATE_PROJECT,
  UpdateProjectPayload,
} from "./constants";
import { findConfig } from "./utils/storybook.config.utils";

const {
  CHROMATIC_BASE_URL = "https://www.chromatic.com",
  CHROMATIC_ADDON_NAME = "@chromaui/addon-visual-tests",
} = process.env;

/**
 * to load the built addon in this test Storybook
 */
function managerEntries(entry: string[] = []) {
  return [...entry, require.resolve("./manager.mjs")];
}

async function serverChannel(
  channel: Channel,
  { projectToken: initialProjectToken }: { projectToken: string }
) {
  let projectToken = initialProjectToken;
  channel.on(START_BUILD, async () => {
    let sent = false;
    await run({
      flags: {
        projectToken,
      },
      options: {
        onTaskComplete(ctx: any) {
          // eslint-disable-next-line no-console
          console.log(`Completed task '${ctx.title}'`);
          if (ctx.announcedBuild && !sent) {
            // eslint-disable-next-line no-console
            console.log("emitting", BUILD_STARTED);
            channel.emit(BUILD_STARTED, ctx.announcedBuild.id);
            sent = true;
          }
        },
      } as any,
    });
  });

  channel.on(
    UPDATE_PROJECT,
    async ({ projectId, projectToken: updatedProjectToken }: UpdateProjectPayload) => {
      projectToken = updatedProjectToken;

      const mainPath = await findConfig("main");
      const MainConfig = await readConfig(mainPath);

      const addonsConfig = MainConfig.getFieldValue(["addons"]);
      const updatedAddonsConfig = addonsConfig.map(
        (addonConfig: string | { name: string; options?: Record<string, string> }) => {
          const fullConfig = typeof addonConfig === "string" ? { name: addonConfig } : addonConfig;
          if (fullConfig.name === CHROMATIC_ADDON_NAME) {
            return {
              ...fullConfig,
              options: { projectId, projectToken, ...fullConfig.options },
            };
          }
          return addonConfig;
        }
      );

      MainConfig.setFieldValue(["addons"], updatedAddonsConfig);
      await writeConfig(MainConfig);
    }
  );

  channel.on(READ_PROJECT, async () => {
    const mainPath = await findConfig("main");
    const MainConfig = await readConfig(mainPath);

    const addonsConfig: StorybookConfig["addons"] = MainConfig.getFieldValue(["addons"]);
    const chromaticAddon = addonsConfig.find((addonConfig) => {
      const fullConfig = typeof addonConfig === "string" ? { name: addonConfig } : addonConfig;
      return fullConfig.name === CHROMATIC_ADDON_NAME;
    });

    const projectId =
      chromaticAddon && typeof chromaticAddon !== "string"
        ? chromaticAddon?.options?.projectId
        : null;
    channel.emit(RESPOND_PROJECT, { projectId });
  });

  return channel;
}

// TODO: use the chromatic CLI to get this info?
const execPromise = promisify(exec);
async function getGitInfo() {
  const branch = (await execPromise("git rev-parse --abbrev-ref HEAD")).stdout.trim();
  const commit = (await execPromise("git log -n 1 HEAD --format='%H'")).stdout.trim();
  const result = (await execPromise("git config --get remote.origin.url")).stdout.trim();
  const downcasedResult = result.toLowerCase();
  const [, slug] = downcasedResult.match(/([^/:]+\/[^/]+?)(\.git)?$/) || [];
  return { branch, commit, slug };
}

const config = {
  managerEntries,
  experimental_serverChannel: serverChannel,
  env: async (
    env: Record<string, string>,
    { projectId, configType }: { projectId: string; configType: "development" | "production" }
  ) => {
    if (configType === "production") return env;

    const { branch, commit, slug } = await getGitInfo();
    return {
      ...env,
      CHROMATIC_BASE_URL,
      CHROMATIC_PROJECT_ID: projectId || "",
      GIT_BRANCH: branch,
      GIT_COMMIT: commit,
      GIT_SLUG: slug,
    };
  },
};

export default config;
