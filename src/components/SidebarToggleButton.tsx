import { Badge as BaseBadge } from "@storybook/components";
import { css, styled } from "@storybook/theming";
import pluralize from "pluralize";
import React, { useState } from "react";

import { IconButton } from "./IconButton";

const Badge = styled(BaseBadge)(({ theme }) => ({
  padding: "4px 8px",
  fontSize: theme.typography.size.s1,
}));

const Button = styled(IconButton)(
  {
    "&:hover [data-badge], [data-badge=true]": {
      background: "#E3F3FF",
      borderColor: "rgba(2, 113, 182, 0.1)",
      color: "#0271B6",
    },
  },
  ({ active, theme }) =>
    !active &&
    css({
      "&:hover": {
        color: theme.color.defaultText,
      },
    })
);

interface SidebarToggleButtonProps {
  count: number;
  onEnable: () => void;
  onDisable: () => void;
}

export const SidebarToggleButton = React.memo(function SidebarToggleButton({
  count,
  onEnable,
  onDisable,
}: SidebarToggleButtonProps) {
  const [filter, setFilter] = useState(false);

  const toggleFilter = () => {
    setFilter(!filter);
    if (filter) onDisable();
    else onEnable();
  };

  return (
    <Button active={filter} onClick={toggleFilter}>
      <Badge status="warning" data-badge={filter}>
        {count}
      </Badge>
      <span>{pluralize("Change", count)}</span>
    </Button>
  );
});