export type UserFields = {
  name: string;
  type: "string" | "number" | "boolean" | "date" | "string[]";
  input: boolean;
  required?: boolean;
  fieldName?: string;
};
export const userFields: UserFields[] = [
  {
    name: "role",
    type: "string",
    input: false,
  },
  {
    name: "panel",
    type: "string",
    input: false,
  },
  {
    name: "employeeId",
    type: "string",
    input: false,
  },
  {
    name: "employeeEmail",
    type: "string",
    input: false,
  },
  {
    name: "country",
    type: "string",
    input: false,
  },
  {
    name: "state",
    type: "string",
    input: false,
  },
  {
    name: "city",
    type: "string",
    input: false,
  },
  {
    name: "address",
    type: "string",
    input: false,
  },
];
