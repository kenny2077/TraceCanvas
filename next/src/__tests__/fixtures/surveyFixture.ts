/**
 * Survey fixture for prompt-lab testing.
 *
 * A realistic 15-row employee engagement survey in CSV form,
 * plus parsed JSON with inferred schema. Used by prompt.test.ts
 * and the Prompt Lab to test whether agents can generate source-keyed
 * HTML that faithfully represents structured survey data.
 */

/** Raw CSV as pasted into the editor. */
export const SURVEY_CSV = `department,question,category,score,responses,comment
Engineering,"How satisfied are you with remote work flexibility?",Workplace,4.2,87,"Most engineers prefer 3 days remote, 2 in-office"
Engineering,"Do you feel your work is recognized?",Recognition,3.1,87,"Recognition is inconsistent across teams"
Engineering,"How would you rate career growth opportunities?",Growth,2.8,87,"Junior engineers want clearer promotion criteria"
Design,"How satisfied are you with remote work flexibility?",Workplace,4.5,23,"Design team is fully remote and happy"
Design,"Do you feel your work is recognized?",Recognition,3.8,23,"Design reviews help but peer recognition is lacking"
Design,"How would you rate career growth opportunities?",Growth,3.2,23,"Limited IC track beyond Senior Designer"
Marketing,"How satisfied are you with remote work flexibility?",Workplace,4.0,31,"Hybrid schedule works well for events team"
Marketing,"Do you feel your work is recognized?",Recognition,3.5,31,"Campaign wins are celebrated, day-to-day less so"
Marketing,"How would you rate career growth opportunities?",Growth,3.0,31,"Want more cross-functional project opportunities"
Sales,"How satisfied are you with remote work flexibility?",Workplace,3.8,42,"Field sales already remote; inside sales want more flexibility"
Sales,"Do you feel your work is recognized?",Recognition,4.0,42,"Commission structure provides clear recognition"
Sales,"How would you rate career growth opportunities?",Growth,3.5,42,"Clear path from SDR → AE → Enterprise AE"
HR,"How satisfied are you with remote work flexibility?",Workplace,4.8,12,"HR team is fully distributed"
HR,"Do you feel your work is recognized?",Recognition,3.2,12,"HR work is often invisible until something goes wrong"
HR,"How would you rate career growth opportunities?",Growth,2.5,12,"Small team limits upward mobility"`;

/** Parsed JSON form — what `summarizeForAgent()` would produce for CSV input. */
export const SURVEY_JSON = {
  fields: ["department", "question", "category", "score", "responses", "comment"],
  rows: [
    {
      department: "Engineering",
      question: "How satisfied are you with remote work flexibility?",
      category: "Workplace",
      score: 4.2,
      responses: 87,
      comment: "Most engineers prefer 3 days remote, 2 in-office",
    },
    {
      department: "Engineering",
      question: "Do you feel your work is recognized?",
      category: "Recognition",
      score: 3.1,
      responses: 87,
      comment: "Recognition is inconsistent across teams",
    },
    {
      department: "Engineering",
      question: "How would you rate career growth opportunities?",
      category: "Growth",
      score: 2.8,
      responses: 87,
      comment: "Junior engineers want clearer promotion criteria",
    },
    {
      department: "Design",
      question: "How satisfied are you with remote work flexibility?",
      category: "Workplace",
      score: 4.5,
      responses: 23,
      comment: "Design team is fully remote and happy",
    },
    {
      department: "Design",
      question: "Do you feel your work is recognized?",
      category: "Recognition",
      score: 3.8,
      responses: 23,
      comment: "Design reviews help but peer recognition is lacking",
    },
    {
      department: "Design",
      question: "How would you rate career growth opportunities?",
      category: "Growth",
      score: 3.2,
      responses: 23,
      comment: "Limited IC track beyond Senior Designer",
    },
    {
      department: "Marketing",
      question: "How satisfied are you with remote work flexibility?",
      category: "Workplace",
      score: 4.0,
      responses: 31,
      comment: "Hybrid schedule works well for events team",
    },
    {
      department: "Marketing",
      question: "Do you feel your work is recognized?",
      category: "Recognition",
      score: 3.5,
      responses: 31,
      comment: "Campaign wins are celebrated, day-to-day less so",
    },
    {
      department: "Marketing",
      question: "How would you rate career growth opportunities?",
      category: "Growth",
      score: 3.0,
      responses: 31,
      comment: "Want more cross-functional project opportunities",
    },
    {
      department: "Sales",
      question: "How satisfied are you with remote work flexibility?",
      category: "Workplace",
      score: 3.8,
      responses: 42,
      comment: "Field sales already remote; inside sales want more flexibility",
    },
    {
      department: "Sales",
      question: "Do you feel your work is recognized?",
      category: "Recognition",
      score: 4.0,
      responses: 42,
      comment: "Commission structure provides clear recognition",
    },
    {
      department: "Sales",
      question: "How would you rate career growth opportunities?",
      category: "Growth",
      score: 3.5,
      responses: 42,
      comment: "Clear path from SDR → AE → Enterprise AE",
    },
    {
      department: "HR",
      question: "How satisfied are you with remote work flexibility?",
      category: "Workplace",
      score: 4.8,
      responses: 12,
      comment: "HR team is fully distributed",
    },
    {
      department: "HR",
      question: "Do you feel your work is recognized?",
      category: "Recognition",
      score: 3.2,
      responses: 12,
      comment: "HR work is often invisible until something goes wrong",
    },
    {
      department: "HR",
      question: "How would you rate career growth opportunities?",
      category: "Growth",
      score: 2.5,
      responses: 12,
      comment: "Small team limits upward mobility",
    },
  ],
};

/**
 * Source keys derived from the survey schema. These are the only valid
 * `<!-- pf-src: ... -->` targets an agent may reference.
 */
export const SURVEY_SOURCE_KEYS = [
  "rows[].department",
  "rows[].question",
  "rows[].category",
  "rows[].score",
  "rows[].responses",
  "rows[].comment",
];

/**
 * Expected aggregate values for content-fidelity sampling.
 * The verification engine picks a few of these and checks whether
 * the generated HTML contains the value string.
 */
export const SURVEY_FIDELITY_SAMPLES = [
  { key: "rows[0].score", value: "4.2" },
  { key: "rows[3].department", value: "Design" },
  { key: "rows[14].comment", value: "Small team limits upward mobility" },
  { key: "rows[5].score", value: "3.2" },
];
