import { useState } from "react";
import { Provider, defaultTheme, Button, TextField, Heading, Flex, View } from "@adobe/react-spectrum";

function App() {
  const [count, setCount] = useState(0);
  const [name, setName] = useState("");

  return (
    <Provider theme={defaultTheme} colorScheme="light">
      <View padding="size-200">
        <Flex direction="column" gap="size-200" alignItems="start" maxWidth="size-3600">
          <Heading level={1}>React Spectrum Demo</Heading>
          <TextField
            label="Your Name"
            value={name}
            onChange={setName}
            placeholder="Enter your name"
          />
          <Button variant="cta" onPress={() => setCount(count + 1)}>
            Count is {count}
          </Button>
          {name && (
            <Heading level={3}>Hello, {name}!</Heading>
          )}
        </Flex>
      </View>
    </Provider>
  );
}

export default App;
