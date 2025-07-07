import { Annotation } from "@langchain/langgraph";

const InputStateAnnotation = Annotation.Root({
  question: Annotation("string"),
});

const StateAnnotation = Annotation.Root({
  question: Annotation("string"),
  query: Annotation("string"),
  result: Annotation("string"),
  answer: Annotation("string"),
});