import type { Person, Relationship } from "@/types/family";

export const samplePeople: Person[] = [
  {
    id: "tapiwa",
    firstName: "Tapiwa",
    surname: "Moyo",
    sex: "male",
  },

  {
    id: "tawanda",
    firstName: "Tawanda",
    surname: "Moyo",
    sex: "male",
  },

  {
    id: "chipo",
    firstName: "Chipo",
    surname: "Moyo",
    sex: "female",
  },

  {
    id: "farai",
    firstName: "Farai",
    surname: "Moyo",
    sex: "male",
  },
];

export const sampleRelationships: Relationship[] = [
  {
    id: "tawanda-tapiwa",
    type: "PARENT_OF",
    personAId: "tawanda",
    personBId: "tapiwa",
  },

  {
    id: "chipo-tapiwa",
    type: "PARENT_OF",
    personAId: "chipo",
    personBId: "tapiwa",
  },

  {
    id: "tawanda-chipo",
    type: "SPOUSE_OF",
    personAId: "tawanda",
    personBId: "chipo",
  },

  {
    id: "farai-tawanda",
    type: "SIBLING_OF",
    personAId: "farai",
    personBId: "tawanda",

    // Farai is Tawanda's older brother.
    // Notice: no DOB required.
    seniority: "A_OLDER",
  },
];
