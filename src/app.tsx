import React from "react";
import { Box, Text } from "ink";

export function App(): React.ReactElement {
  return (
    <Box flexDirection="column" width="100%">
      <Box borderStyle="single" borderColor="cyan">
        <Text color="cyan" bold>
          meldr-dash
        </Text>
      </Box>
      <Text color="gray">Loading...</Text>
    </Box>
  );
}
