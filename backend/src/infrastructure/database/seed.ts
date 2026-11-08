import 'dotenv/config';
import { drizzle } from 'drizzle-orm/mysql2';
import { sql } from 'drizzle-orm';
import { type RowDataPacket } from 'mysql2/promise';
import { createMysqlPool } from './connection';

async function main() {
  console.log('[SKILLBRIDGE Seed] Starting MySQL database seeding...');
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required to seed MySQL.');

  const pool = createMysqlPool(databaseUrl);
  const database = drizzle(pool);
  const skills = [
    { name: 'PostgreSQL', category: 'Databases', demandRating: 5 },
    { name: 'React.js', category: 'Frontend', demandRating: 5 },
    { name: 'Node.js', category: 'Backend', demandRating: 5 },
    { name: 'TypeScript', category: 'Languages', demandRating: 5 },
    { name: 'Python', category: 'Backend & AI', demandRating: 5 },
    { name: 'Docker', category: 'DevOps', demandRating: 4 },
    { name: 'Drizzle ORM', category: 'Databases', demandRating: 4 },
  ];
  const assessmentQuestions: Record<string, Array<{ key: string; prompt: string; options: string[]; correct: number }>> = {
    PostgreSQL: [
      { key: 'postgresql-1', prompt: 'Which clause filters grouped rows after aggregation?', options: ['WHERE', 'HAVING', 'ORDER BY', 'LIMIT'], correct: 1 },
      { key: 'postgresql-2', prompt: 'Which PostgreSQL command makes a transaction durable?', options: ['COMMIT', 'CHECKPOINT only', 'ANALYZE', 'VACUUM'], correct: 0 },
      { key: 'postgresql-3', prompt: 'What does a LEFT JOIN preserve?', options: ['Only matching right rows', 'Every left row, with NULLs for unmatched right rows', 'Only rows without matches', 'The newest row from each table'], correct: 1 },
      { key: 'postgresql-4', prompt: 'Which index type is the default and is generally suited to equality and range comparisons?', options: ['GIN', 'BRIN', 'B-tree', 'Hash only'], correct: 2 },
      { key: 'postgresql-5', prompt: 'What is the purpose of a foreign key?', options: ['Encrypt a column', 'Enforce a relationship to a referenced key', 'Sort query output', 'Create a backup'], correct: 1 },
    ],
    'React.js': [
      { key: 'react-1', prompt: 'What should a component do when rendering the same list of items?', options: ['Use stable keys for list elements', 'Mutate the list during render', 'Use array indexes in every case', 'Call setState for each item'], correct: 0 },
      { key: 'react-2', prompt: 'When should an effect cleanup function run?', options: ['Only before the first render', 'Before rerunning the effect and when the component unmounts', 'After every click regardless of dependencies', 'Only when the page reloads'], correct: 1 },
      { key: 'react-3', prompt: 'Why should state arrays be updated immutably?', options: ['React can detect a new state reference reliably', 'Arrays cannot be copied', 'It avoids using event handlers', 'It forces a full page reload'], correct: 0 },
      { key: 'react-4', prompt: 'What is a controlled input?', options: ['An input whose value is managed by React state', 'An input that cannot be focused', 'An input rendered only on the server', 'An input without an onChange handler'], correct: 0 },
      { key: 'react-5', prompt: 'What does lifting state up usually mean?', options: ['Moving shared state to the closest common parent', 'Moving state into CSS', 'Duplicating state in every child', 'Replacing props with global variables'], correct: 0 },
    ],
    'Node.js': [
      { key: 'node-1', prompt: 'What does Node.js primarily use to handle many I/O operations efficiently?', options: ['A synchronous thread per request', 'An event loop with non-blocking I/O', 'A browser DOM loop', 'A database trigger for every request'], correct: 1 },
      { key: 'node-2', prompt: 'Where should production secrets such as API keys be kept?', options: ['Committed source files', 'Environment or secret-management configuration', 'Public frontend bundles', 'URL query strings'], correct: 1 },
      { key: 'node-3', prompt: 'Why use parameterized SQL queries?', options: ['To prevent values from changing', 'To separate SQL structure from data and reduce injection risk', 'To make every query asynchronous', 'To disable database indexes'], correct: 1 },
      { key: 'node-4', prompt: 'What is the purpose of middleware in Express?', options: ['Process requests and responses in the request pipeline', 'Replace the HTTP protocol', 'Store all data in memory', 'Compile TypeScript at runtime'], correct: 0 },
      { key: 'node-5', prompt: 'How should an async route communicate a rejected operation?', options: ['Ignore it', 'Pass or handle the error through the application error flow', 'Return HTTP 200 with fabricated data', 'Terminate the process'], correct: 1 },
    ],
    TypeScript: [
      { key: 'typescript-1', prompt: 'What does a TypeScript union type such as string | number express?', options: ['The value must be both types simultaneously', 'The value can be either listed type', 'The value is always a string at runtime', 'The type is removed from source control'], correct: 1 },
      { key: 'typescript-2', prompt: 'What does strictNullChecks help identify?', options: ['Potential use of null or undefined where a value is required', 'Unused CSS selectors', 'Slow network requests', 'Database deadlocks'], correct: 0 },
      { key: 'typescript-3', prompt: 'What is the safest first step when receiving unknown data?', options: ['Cast it to any', 'Validate or narrow it before use', 'Assume it matches an interface', 'Ignore the response status'], correct: 1 },
      { key: 'typescript-4', prompt: 'What does a generic function allow?', options: ['Typed reuse across different data types', 'Automatic runtime validation', 'Skipping all compiler checks', 'Changing values into strings'], correct: 0 },
      { key: 'typescript-5', prompt: 'What is the purpose of the never type?', options: ['Represent a value that cannot occur or a function that never returns normally', 'Represent any nullable value', 'Mark an optional property', 'Force a runtime exception'], correct: 0 },
    ],
    Python: [
      { key: 'python-1', prompt: 'What does a context manager commonly ensure when used with with?', options: ['Resource cleanup at the end of the block', 'Every operation runs in parallel', 'All exceptions are suppressed', 'Variables become global'], correct: 0 },
      { key: 'python-2', prompt: 'What is the usual purpose of a virtual environment?', options: ['Isolate project dependencies', 'Encrypt Python source', 'Replace the Python interpreter', 'Run code without packages'], correct: 0 },
      { key: 'python-3', prompt: 'What does a dictionary store?', options: ['Ordered numeric indexes only', 'Key-value associations', 'Only unique strings', 'A compiled module cache'], correct: 1 },
      { key: 'python-4', prompt: 'Why should a mutable default argument generally be avoided?', options: ['It can be shared across function calls', 'It cannot contain values', 'Python rejects all defaults', 'It makes the function asynchronous'], correct: 0 },
      { key: 'python-5', prompt: 'What does a generator yield?', options: ['Values lazily as iteration proceeds', 'A database transaction', 'Only a list copy', 'A thread lock'], correct: 0 },
    ],
    Docker: [
      { key: 'docker-1', prompt: 'What is a Docker image?', options: ['A running container process', 'An immutable template used to create containers', 'A virtual machine kernel', 'A network firewall rule'], correct: 1 },
      { key: 'docker-2', prompt: 'What does a Dockerfile describe?', options: ['Steps to build an image', 'Only container runtime logs', 'A database schema', 'A host operating system update'], correct: 0 },
      { key: 'docker-3', prompt: 'Why use a multi-stage build?', options: ['To reduce final image size by separating build and runtime dependencies', 'To run two kernels in one container', 'To persist container memory', 'To disable image layers'], correct: 0 },
      { key: 'docker-4', prompt: 'What is the usual purpose of a volume?', options: ['Persist or share data outside a container writable layer', 'Expose a container port', 'Set the container hostname', 'Build an image faster by disabling cache'], correct: 0 },
      { key: 'docker-5', prompt: 'What does publishing a container port do?', options: ['Map a host port to a container port', 'Encrypt all container files', 'Make an image public', 'Persist environment variables'], correct: 0 },
    ],
    'Drizzle ORM': [
      { key: 'drizzle-1', prompt: 'What is Drizzle ORM designed to provide?', options: ['A type-safe way to work with SQL databases', 'A browser rendering engine', 'A replacement for the database server', 'A CSS utility framework'], correct: 0 },
      { key: 'drizzle-2', prompt: 'Why should schema changes be managed through migrations?', options: ['To apply and track reproducible database changes', 'To bypass schema validation', 'To replace backups', 'To execute frontend code'], correct: 0 },
      { key: 'drizzle-3', prompt: 'What is a key benefit of using parameterized values in Drizzle queries?', options: ['Safer handling of user input', 'Automatic authorization', 'Avoiding all indexes', 'Disabling transactions'], correct: 0 },
      { key: 'drizzle-4', prompt: 'When are database transactions useful?', options: ['When several writes must succeed or fail together', 'Only when reading one row', 'To replace input validation', 'To cache static assets'], correct: 0 },
      { key: 'drizzle-5', prompt: 'What should an application do with a database error?', options: ['Return fabricated success data', 'Handle and report it without exposing sensitive internals', 'Ignore it and continue as if committed', 'Send credentials to the client'], correct: 1 },
    ],
  };

  try {
    for (const skill of skills) {
      await database.execute(sql`
        INSERT INTO skills (id, name, category, demandRating)
        VALUES (UUID(), ${skill.name}, ${skill.category}, ${skill.demandRating})
        ON DUPLICATE KEY UPDATE name = VALUES(name)
      `);
      const [skillRows] = await pool.execute<(RowDataPacket & { id: string })[]>(
        'SELECT id FROM skills WHERE name = ? LIMIT 1',
        [skill.name]
      );
      const skillId = skillRows[0]?.id;
      if (!skillId) throw new Error(`Seeded skill "${skill.name}" could not be found.`);
      for (const [index, question] of assessmentQuestions[skill.name].entries()) {
        await database.execute(sql`
          INSERT INTO skill_assessment_questions
            (id, skillId, questionKey, prompt, optionsJson, correctOption, questionOrder, isActive)
          VALUES
            (${question.key}, ${skillId}, ${question.key}, ${question.prompt},
             ${JSON.stringify(question.options)}, ${question.correct}, ${index + 1}, true)
          ON DUPLICATE KEY UPDATE
            prompt = VALUES(prompt), optionsJson = VALUES(optionsJson),
            correctOption = VALUES(correctOption), questionOrder = VALUES(questionOrder), isActive = true
        `);
      }
    }
    console.log('[SKILLBRIDGE Seed] Skills and candidate skill assessments seeded successfully.');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('[SKILLBRIDGE Seed] Error:', error);
  process.exit(1);
});