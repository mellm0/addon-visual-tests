import type { API_StatusState } from "@storybook/types";
import React, { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery } from "urql";

import { GitInfoPayload, RunningBuildPayload } from "../../constants";
import { getFragment } from "../../gql";
import {
  AddonVisualTestsBuildQuery,
  AddonVisualTestsBuildQueryVariables,
  ReviewTestBatch,
  ReviewTestInputStatus,
  TestStatus,
} from "../../gql/graphql";
import { UpdateStatusFunction } from "../../types";
import { statusMap, testsToStatusUpdate } from "../../utils/testsToStatusUpdate";
import { BuildResults } from "./BuildResults";
import {
  FragmentNextBuildFields,
  FragmentStatusTestFields,
  FragmentStoryBuildFields,
  MutationReviewTest,
  QueryBuild,
} from "./graphql";
import { NoBuild } from "./NoBuild";

const createEmptyStoryStatusUpdate = (state: API_StatusState) => {
  return Object.fromEntries(Object.entries(state).map(([id, update]) => [id, null]));
};

interface VisualTestsProps {
  projectId: string;
  gitInfo: Pick<
    GitInfoPayload,
    "branch" | "slug" | "userEmailHash" | "committedAt" | "uncommittedHash"
  >;
  runningBuild?: RunningBuildPayload;
  startDevBuild: () => void;
  setAccessToken: (accessToken: string | null) => void;
  updateBuildStatus: UpdateStatusFunction;
  storyId: string;
}

export const VisualTests = ({
  runningBuild,
  startDevBuild,
  setAccessToken,
  updateBuildStatus,
  projectId,
  gitInfo,
  storyId,
}: VisualTestsProps) => {
  // The storyId and buildId that drive the test(s) we are currently looking at
  // The user can choose when to change story (via sidebar) and build (via opting into new builds)
  const [storyBuildInfo, setStoryBuildInfo] = useState<{
    storyId: string;
    buildId: string;
  }>();

  const [{ data, error }, rerun] = useQuery<
    AddonVisualTestsBuildQuery,
    AddonVisualTestsBuildQueryVariables
  >({
    query: QueryBuild,
    variables: {
      projectId,
      storyId,
      testStatuses: Object.keys(statusMap) as any as TestStatus[],
      branch: gitInfo.branch || "",
      ...(gitInfo.slug ? { slug: gitInfo.slug } : {}),
      gitUserEmailHash: gitInfo.userEmailHash,
      storyBuildId: storyBuildInfo?.buildId || "",
      hasStoryBuildId: !!storyBuildInfo,
    },
  });

  // Poll for updates
  useEffect(() => {
    const interval = setInterval(rerun, 5000);
    return () => clearInterval(interval);
  }, [rerun]);

  const [{ fetching: isAccepting }, reviewTest] = useMutation(MutationReviewTest);

  const onAccept = useCallback(
    async (testId: string, batch: ReviewTestBatch) => {
      try {
        const { error: reviewError } = await reviewTest({
          input: { testId, status: ReviewTestInputStatus.Accepted, batch },
        });

        if (reviewError) throw reviewError;
      } catch (err) {
        // https://linear.app/chromaui/issue/AP-3279/error-handling
        // eslint-disable-next-line no-console
        console.log("Failed to accept changes:");
        // eslint-disable-next-line no-console
        console.log(err);
      }
    },
    [reviewTest]
  );

  const nextBuild = getFragment(FragmentNextBuildFields, data?.project?.nextBuild);
  // Before we set the storyInfo, we use the nextBuild for story data
  const storyBuild = getFragment(
    FragmentStoryBuildFields,
    data?.storyBuild ?? data?.project?.nextBuild
  );

  // If the next build is *newer* than the current commit, we don't want to switch to the build
  const nextBuildNewer = nextBuild && nextBuild.committedAt > gitInfo.committedAt;
  const canSwitchToNextBuild = nextBuild && !nextBuildNewer;

  // We always set status to the next build's status, as when we change to a new story we'll see
  // the next builds
  const buildStatusUpdate =
    canSwitchToNextBuild &&
    "testsForStatus" in nextBuild &&
    testsToStatusUpdate(getFragment(FragmentStatusTestFields, nextBuild.testsForStatus.nodes));

  useEffect(() => {
    updateBuildStatus((state) => ({
      ...createEmptyStoryStatusUpdate(state),
      ...buildStatusUpdate,
    }));
    // We use the stringified version of buildStatusUpdate to do a deep diff
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(buildStatusUpdate), updateBuildStatus]);

  // Ensure we are holding the right story build
  useEffect(() => {
    setStoryBuildInfo((oldStoryBuildInfo) => {
      return (!oldStoryBuildInfo || oldStoryBuildInfo.storyId !== storyId) && nextBuild?.id
        ? {
            storyId,
            // If the next build is "too new" and we have an old build, stick to it.
            buildId: (!canSwitchToNextBuild && oldStoryBuildInfo?.buildId) || nextBuild.id,
          }
        : oldStoryBuildInfo;
    });
  }, [canSwitchToNextBuild, nextBuild?.id, storyId]);

  const switchToNextBuild = useCallback(
    () => canSwitchToNextBuild && setStoryBuildInfo({ storyId, buildId: nextBuild.id }),
    [canSwitchToNextBuild, nextBuild?.id, storyId]
  );

  const isRunningBuildStarting = !runningBuild || !["success", "error"].includes(runningBuild.step);

  const { branch, uncommittedHash } = gitInfo;
  return !nextBuild || error ? (
    <NoBuild
      {...{
        error,
        hasData: !!data,
        hasNextBuild: !!nextBuild,
        startDevBuild,
        isRunningBuildStarting,
        branch,
        setAccessToken,
      }}
    />
  ) : (
    <BuildResults
      {...{
        runningBuild,
        nextBuild,
        switchToNextBuild: canSwitchToNextBuild && switchToNextBuild,
        startDevBuild,
        isAccepting,
        onAccept,
        storyBuild,
        setAccessToken,
        uncommittedHash,
      }}
    />
  );
};
