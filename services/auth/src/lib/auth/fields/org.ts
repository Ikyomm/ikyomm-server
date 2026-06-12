export type OrgFields = {
  name: string;
  type: "string" | "number" | "boolean" | "date" | "string[]" | "json";
  input: boolean;
  required?: boolean;
  defaultValue?: string | number | boolean | string[] | Record<string, unknown>;
};

export const orgFields: OrgFields[] = [
  {
    name: "email",
    type: "string",
    input: true,
  },
  {
    name: "phoneNumber",
    type: "string",
    input: true,
    required: false,
  },
  {
    name: "websiteDomain",
    type: "string",
    input: true,
    required: false,
  },
  {
    name: "type",
    type: "string",
    input: true,
  },
  {
    name: "isActive",
    type: "boolean",
    input: true,
    required: false,
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
