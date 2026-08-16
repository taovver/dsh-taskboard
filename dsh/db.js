// SQLite 持久层：projects / tasks / comments 三表，node:sqlite DatabaseSync。
// 精简移植自 Codex Taskboard 的 server/database.mjs（去掉迁移阶梯、attachments、
// workflow 画布、recurrence 等二期内容），会话归属字段用 session_id + session_title。
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function now() {
  return new Date().toISOString();
}

function taskFromRow(row) {
  return {
    id: row.id,
    identifier: row.identifier,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    labels: JSON.parse(row.labels),
    sortOrder: row.sort_order,
    sessionId: row.session_id,
    sessionTitle: row.session_title,
    creatorType: row.creator_type,
    creatorId: row.creator_id,
    creatorName: row.creator_name,
    creatorAvatarUrl: row.creator_avatar_url,
    archivedAt: row.archived_at,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function commentFromRow(row) {
  return {
    id: row.id,
    taskId: row.task_id,
    body: row.body,
    sessionId: row.session_id,
    sessionTitle: row.session_title,
    authorType: row.author_type,
    authorId: row.author_id,
    authorName: row.author_name,
    authorAvatarUrl: row.author_avatar_url,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function projectFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    workspacePath: row.workspace_path,
    issueCount: Number(row.issue_count ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function projectPrefix(projectId) {
  const prefix = projectId.toUpperCase().replace(/[^A-Z0-9]+/g, "");
  return (prefix || "TASK").slice(0, 12);
}

export class TaskboardDB {
  constructor(filename) {
    mkdirSync(path.dirname(filename), { recursive: true });
    this.database = new DatabaseSync(filename);
    this.database.exec(
      "PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;",
    );
    this.#migrate();
  }

  #migrate() {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        workspace_path TEXT,
        next_task_number INTEGER NOT NULL DEFAULT 1 CHECK (next_task_number > 0),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        identifier TEXT NOT NULL UNIQUE,
        project_id TEXT NOT NULL REFERENCES projects(id),
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL CHECK (status IN (
          'backlog', 'todo', 'in_progress', 'in_review', 'blocked', 'done', 'canceled'
        )),
        priority TEXT NOT NULL CHECK (priority IN ('none', 'urgent', 'high', 'medium', 'low')),
        labels TEXT NOT NULL DEFAULT '[]',
        sort_order REAL NOT NULL,
        session_id TEXT,
        session_title TEXT,
        creator_type TEXT NOT NULL DEFAULT 'user',
        creator_id TEXT NOT NULL DEFAULT 'local-user',
        creator_name TEXT NOT NULL DEFAULT '本地用户',
        creator_avatar_url TEXT,
        archived_at TEXT,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS tasks_project_status_sort
        ON tasks(project_id, archived_at, status, sort_order, created_at);

      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        body TEXT NOT NULL,
        session_id TEXT,
        session_title TEXT,
        author_type TEXT NOT NULL DEFAULT 'user',
        author_id TEXT NOT NULL DEFAULT 'local-user',
        author_name TEXT NOT NULL DEFAULT '本地用户',
        author_avatar_url TEXT,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS comments_task_created
        ON comments(task_id, created_at, id);

      -- 默认项目
      INSERT OR IGNORE INTO projects (id, name, workspace_path, next_task_number, created_at, updated_at)
      VALUES ('local', '本地项目', NULL, 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
    `);
  }

  close() {
    this.database.close();
  }

  // ---------- projects ----------

  listProjects() {
    return this.database
      .prepare(`
        SELECT
          projects.id,
          projects.name,
          projects.workspace_path,
          projects.created_at,
          projects.updated_at,
          COUNT(tasks.id) AS issue_count
        FROM projects
        LEFT JOIN tasks ON tasks.project_id = projects.id
        GROUP BY projects.id, projects.name, projects.workspace_path, projects.created_at, projects.updated_at
        ORDER BY projects.created_at, projects.id
      `)
      .all()
      .map(projectFromRow);
  }

  createProject(input) {
    const timestamp = now();
    try {
      this.database
        .prepare(`
          INSERT INTO projects (id, name, workspace_path, next_task_number, created_at, updated_at)
          VALUES (?, ?, ?, 1, ?, ?)
        `)
        .run(input.id, input.name, input.workspacePath ?? null, timestamp, timestamp);
    } catch (error) {
      if (String(error.message).includes("UNIQUE constraint failed")) {
        throw new ApiError(409, "PROJECT_EXISTS", `Project '${input.id}' already exists`);
      }
      throw error;
    }
    return this.getProject(input.id);
  }

  getProject(id) {
    const row = this.database
      .prepare(`
        SELECT
          projects.id,
          projects.name,
          projects.workspace_path,
          projects.created_at,
          projects.updated_at,
          COUNT(tasks.id) AS issue_count
        FROM projects
        LEFT JOIN tasks ON tasks.project_id = projects.id
        WHERE projects.id = ?
        GROUP BY projects.id, projects.name, projects.workspace_path, projects.created_at, projects.updated_at
      `)
      .get(id);
    return row ? projectFromRow(row) : null;
  }

  // ---------- tasks ----------

  listTasks(filters) {
    const where = [];
    const values = [];
    if (filters.projectId) {
      where.push("project_id = ?");
      values.push(filters.projectId);
    }
    if (filters.status) {
      where.push("status = ?");
      values.push(filters.status);
    }
    if (filters.archived === "false") {
      where.push("archived_at IS NULL");
    } else if (filters.archived === "true") {
      where.push("archived_at IS NOT NULL");
    }

    const sql = `
      SELECT * FROM tasks
      ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY
        CASE status
          WHEN 'backlog' THEN 1
          WHEN 'todo' THEN 2
          WHEN 'in_progress' THEN 3
          WHEN 'in_review' THEN 4
          WHEN 'blocked' THEN 5
          WHEN 'done' THEN 6
          WHEN 'canceled' THEN 7
        END,
        sort_order,
        created_at,
        id
    `;
    return this.database.prepare(sql).all(...values).map(taskFromRow);
  }

  getTask(id) {
    const row = this.database
      .prepare("SELECT * FROM tasks WHERE id = ? OR identifier = ?")
      .get(id, id);
    return row ? taskFromRow(row) : null;
  }

  createTask(input) {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const project = this.database
        .prepare("SELECT id, next_task_number FROM projects WHERE id = ?")
        .get(input.projectId);
      if (!project) {
        throw new ApiError(404, "PROJECT_NOT_FOUND", `Project '${input.projectId}' does not exist`);
      }

      const number = project.next_task_number;
      const identifier = `${projectPrefix(project.id)}-${number}`;
      const id = randomUUID();
      const timestamp = now();
      let sortOrder = input.sortOrder;
      if (sortOrder === undefined) {
        const row = this.database
          .prepare(`
            SELECT COALESCE(MAX(sort_order), 0) AS maximum
            FROM tasks
            WHERE project_id = ? AND status = ? AND archived_at IS NULL
          `)
          .get(input.projectId, input.status);
        sortOrder = row.maximum + 1000;
      }

      this.database
        .prepare("UPDATE projects SET next_task_number = next_task_number + 1, updated_at = ? WHERE id = ?")
        .run(timestamp, input.projectId);
      this.database
        .prepare(`
          INSERT INTO tasks (
            id, identifier, project_id, title, description, status, priority, labels,
            sort_order, session_id, session_title, creator_type, creator_id, creator_name, creator_avatar_url,
            archived_at, version, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, ?, ?)
        `)
        .run(
          id,
          identifier,
          input.projectId,
          input.title,
          input.description ?? "",
          input.status ?? "backlog",
          input.priority ?? "none",
          JSON.stringify(input.labels ?? []),
          sortOrder,
          input.session?.id ?? null,
          input.session?.title ?? null,
          input.actor?.type ?? "user",
          input.actor?.id ?? "local-user",
          input.actor?.name ?? "本地用户",
          input.actor?.avatarUrl ?? null,
          timestamp,
          timestamp,
        );
      this.database.exec("COMMIT");
      return this.getTask(id);
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  updateTask(id, version, changes, session) {
    const current = this.#requireTask(id);
    this.#requireVersion(current, version);

    const columns = {
      title: "title",
      description: "description",
      status: "status",
      priority: "priority",
      labels: "labels",
    };
    const assignments = [];
    const values = [];
    for (const [key, value] of Object.entries(changes)) {
      const column = columns[key];
      if (!column) continue;
      assignments.push(`${column} = ?`);
      values.push(key === "labels" ? JSON.stringify(value) : value);
    }
    if (session?.id) {
      assignments.push("session_id = ?", "session_title = ?");
      values.push(session.id, session.title ?? null);
    }
    assignments.push("version = version + 1", "updated_at = ?");
    const timestamp = now();
    values.push(timestamp, current.id, version);

    this.database.exec("BEGIN IMMEDIATE");
    try {
      const result = this.database
        .prepare(`UPDATE tasks SET ${assignments.join(", ")} WHERE id = ? AND version = ?`)
        .run(...values);
      if (result.changes !== 1) {
        this.#throwMissingOrConflict(id, version);
      }
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
    return this.getTask(current.id);
  }

  moveTask(id, version, status, sortOrder, session) {
    const current = this.#requireTask(id);
    this.#requireVersion(current, version);
    if (current.archivedAt !== null) {
      throw new ApiError(409, "TASK_ARCHIVED", "Archived tasks cannot be moved");
    }
    if (sortOrder === undefined) {
      const row = this.database
        .prepare(`
          SELECT COALESCE(MAX(sort_order), 0) AS maximum
          FROM tasks
          WHERE project_id = ? AND status = ? AND archived_at IS NULL AND id != ?
        `)
        .get(current.projectId, status, current.id);
      sortOrder = row.maximum + 1000;
    }

    const timestamp = now();
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const result = this.database
        .prepare(`
          UPDATE tasks
          SET status = ?, sort_order = ?, session_id = COALESCE(?, session_id), session_title = COALESCE(?, session_title),
              version = version + 1, updated_at = ?
          WHERE id = ? AND version = ?
        `)
        .run(status, sortOrder, session?.id ?? null, session?.title ?? null, timestamp, current.id, version);
      if (result.changes !== 1) {
        this.#throwMissingOrConflict(id, version);
      }
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
    return this.getTask(current.id);
  }

  archiveTask(id, version, session) {
    const current = this.#requireTask(id);
    this.#requireVersion(current, version);
    const timestamp = now();
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const result = this.database
        .prepare(`
          UPDATE tasks
          SET archived_at = ?, session_id = COALESCE(?, session_id), session_title = COALESCE(?, session_title),
              version = version + 1, updated_at = ?
          WHERE id = ? AND version = ?
        `)
        .run(timestamp, session?.id ?? null, session?.title ?? null, timestamp, current.id, version);
      if (result.changes !== 1) {
        this.#throwMissingOrConflict(id, version);
      }
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
    return this.getTask(current.id);
  }

  restoreTask(id, version, session) {
    const current = this.#requireTask(id);
    this.#requireVersion(current, version);
    if (current.archivedAt === null) {
      throw new ApiError(409, "TASK_NOT_ARCHIVED", "Only archived tasks can be restored");
    }
    const timestamp = now();
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const result = this.database
        .prepare(`
          UPDATE tasks
          SET archived_at = NULL, session_id = COALESCE(?, session_id), session_title = COALESCE(?, session_title),
              version = version + 1, updated_at = ?
          WHERE id = ? AND version = ?
        `)
        .run(session?.id ?? null, session?.title ?? null, timestamp, current.id, version);
      if (result.changes !== 1) {
        this.#throwMissingOrConflict(id, version);
      }
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
    return this.getTask(current.id);
  }

  // ---------- comments ----------

  listComments(taskId) {
    const task = this.#requireTask(taskId);
    return this.database
      .prepare("SELECT * FROM comments WHERE task_id = ? ORDER BY created_at, id")
      .all(task.id)
      .map(commentFromRow);
  }

  createComment(taskId, input) {
    const task = this.#requireTask(taskId);
    const id = randomUUID();
    const timestamp = now();
    this.database
      .prepare(`
        INSERT INTO comments (
          id, task_id, body, session_id, session_title,
          author_type, author_id, author_name, author_avatar_url,
          version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `)
      .run(
        id,
        task.id,
        input.body,
        input.session?.id ?? null,
        input.session?.title ?? null,
        input.actor.type,
        input.actor.id,
        input.actor.name,
        input.actor.avatarUrl ?? null,
        timestamp,
        timestamp,
      );
    return this.getComment(id);
  }

  getComment(id) {
    const row = this.database.prepare("SELECT * FROM comments WHERE id = ?").get(id);
    return row ? commentFromRow(row) : null;
  }

  updateComment(id, version, body, session) {
    const current = this.#requireComment(id);
    this.#requireCommentVersion(current, version);
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const result = this.database
        .prepare(`
          UPDATE comments
          SET body = ?, session_id = COALESCE(?, session_id), session_title = COALESCE(?, session_title),
              version = version + 1, updated_at = ?
          WHERE id = ? AND version = ?
        `)
        .run(body, session?.id ?? null, session?.title ?? null, now(), id, version);
      if (result.changes !== 1) {
        this.#throwMissingCommentOrConflict(id, version);
      }
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
    return this.getComment(id);
  }

  deleteComment(id, version) {
    const current = this.#requireComment(id);
    this.#requireCommentVersion(current, version);
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const result = this.database.prepare("DELETE FROM comments WHERE id = ? AND version = ?").run(id, version);
      if (result.changes !== 1) {
        this.#throwMissingCommentOrConflict(id, version);
      }
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
    return current;
  }

  // ---------- helpers ----------

  #requireTask(id) {
    const task = this.getTask(id);
    if (!task) {
      throw new ApiError(404, "TASK_NOT_FOUND", `Task '${id}' does not exist`);
    }
    return task;
  }

  #requireComment(id) {
    const comment = this.getComment(id);
    if (!comment) {
      throw new ApiError(404, "COMMENT_NOT_FOUND", `Comment '${id}' does not exist`);
    }
    return comment;
  }

  #requireVersion(task, expectedVersion) {
    if (task.version !== expectedVersion) {
      throw new ApiError(409, "VERSION_CONFLICT", "Task was changed by another client", {
        expectedVersion,
        actualVersion: task.version,
      });
    }
  }

  #requireCommentVersion(comment, expectedVersion) {
    if (comment.version !== expectedVersion) {
      throw new ApiError(409, "VERSION_CONFLICT", "Comment was changed by another client", {
        expectedVersion,
        actualVersion: comment.version,
      });
    }
  }

  #throwMissingOrConflict(id, expectedVersion) {
    const task = this.getTask(id);
    if (!task) {
      throw new ApiError(404, "TASK_NOT_FOUND", `Task '${id}' does not exist`);
    }
    throw new ApiError(409, "VERSION_CONFLICT", "Task was changed by another client", {
      expectedVersion,
      actualVersion: task.version,
    });
  }

  #throwMissingCommentOrConflict(id, expectedVersion) {
    const comment = this.getComment(id);
    if (!comment) {
      throw new ApiError(404, "COMMENT_NOT_FOUND", `Comment '${id}' does not exist`);
    }
    throw new ApiError(409, "VERSION_CONFLICT", "Comment was changed by another client", {
      expectedVersion,
      actualVersion: comment.version,
    });
  }
}
