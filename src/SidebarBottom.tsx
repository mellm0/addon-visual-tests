import { type API, useStorybookState } from "@storybook/manager-api";
import { styled } from "@storybook/theming";
import type { API_FilterFunction } from "@storybook/types";
import React, { useCallback, useEffect } from "react";

import { SidebarToggleButton } from "./components/SidebarToggleButton";
import { ADDON_ID, ENABLE_FILTER } from "./constants";

const filterNone: API_FilterFunction = () => true;
const filterWarn: API_FilterFunction = ({ status }) => status?.[ADDON_ID]?.status === "warn";
const filterError: API_FilterFunction = ({ status }) => status?.[ADDON_ID]?.status === "error";
const filterBoth: API_FilterFunction = ({ status }) =>
  status?.[ADDON_ID]?.status === "warn" || status?.[ADDON_ID]?.status === "error";

const Wrapper = styled.div({
  display: "flex",
  gap: 5,
});

interface SidebarBottomProps {
  api: API;
}

export const SidebarBottom = ({ api }: SidebarBottomProps) => {
  const [showWarnings, setShowWarnings] = React.useState(false);
  const [showErrors, setShowErrors] = React.useState(false);

  const { status } = useStorybookState();
  const warnings = Object.values(status).filter((value) => value[ADDON_ID]?.status === "warn");
  const errors = Object.values(status).filter((value) => value[ADDON_ID]?.status === "error");
  const hasWarnings = warnings.length > 0;
  const hasErrors = errors.length > 0;

  const toggleWarnings = useCallback(() => setShowWarnings((shown) => !shown), []);
  const toggleErrors = useCallback(() => setShowErrors((shown) => !shown), []);

  useEffect(() => {
    let filter = filterNone;
    if (hasWarnings && showWarnings) filter = filterWarn;
    if (hasErrors && showErrors) filter = filter === filterWarn ? filterBoth : filterError;
    api.experimental_setFilter(ADDON_ID, filter);
    api.emit(ENABLE_FILTER, filter);
  }, [api, hasWarnings, hasErrors, showWarnings, showErrors]);

  if (!hasWarnings && !hasErrors) return null;

  return (
    <Wrapper id="sidebar-bottom-wrapper">
      {hasWarnings && (
        <SidebarToggleButton
          id="changes-found-filter"
          active={showWarnings}
          count={warnings.length}
          label="Change"
          status="warning"
          onClick={toggleWarnings}
        />
      )}
      {hasErrors && (
        <SidebarToggleButton
          id="errors-found-filter"
          active={showErrors}
          count={errors.length}
          label="Error"
          status="critical"
          onClick={toggleErrors}
        />
      )}
    </Wrapper>
  );
};
