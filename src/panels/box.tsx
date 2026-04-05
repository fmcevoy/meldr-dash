import React from "react";
import { Box, Text } from "ink";

interface PanelBoxProps {
  title: string;
  titleColor?: string;
  children: React.ReactNode;
  width?: string | number;
  height?: number;
}

export function PanelBox({
  title,
  titleColor = "cyan",
  children,
  width,
  height,
}: PanelBoxProps): React.ReactElement {
  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      width={width}
      height={height}
    >
      <Text color={titleColor} bold dimColor>
        {" "}
        {title}{" "}
      </Text>
      {children}
    </Box>
  );
}
