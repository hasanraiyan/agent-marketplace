"use client";

import * as React from "react";
import { CodeEditor } from "@/components/ui/code-editor";

const SAMPLE = `---
name: roll-dice
description: Roll dice using a random number generator. Use when asked to roll a die (d6, d20, etc.), roll dice, or generate a random dice roll.
---

To roll a die, use the following command that generates a random number from 1
to the given number of sides.

## Example

\`\`\`python
import random

def roll(sides=6):
    return random.randint(1, sides)

print(roll(20))
\`\`\`

This is a fairly long line without any spaces in it whatsoever to test wrapping klejdfkljsdhfksdhfksdhfksdhfksdhfksdhfksdhfksdhfksdhfksdhfk.

`.repeat(3);

export default function ScratchTest() {
  const [value, setValue] = React.useState(SAMPLE);
  return (
    <div className="flex h-screen w-full flex-col gap-4 bg-background p-4">
      <button
        type="button"
        className="w-fit rounded border px-2 py-1 text-xs"
        onClick={() => document.documentElement.classList.toggle("dark")}
      >
        Toggle dark
      </button>
      <div className="flex min-h-0 flex-1 border">
        <CodeEditor
          value={value}
          onChange={setValue}
          language="markdown"
          placeholder="type here"
          className="h-full min-h-0 w-full flex-1"
        />
      </div>
    </div>
  );
}
