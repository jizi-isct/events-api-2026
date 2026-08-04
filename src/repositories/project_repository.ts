import { Project, ProjectId } from "../models";

class ProjectRepository {
  db: D1Database;
  constructor(db: D1Database) {
    return {
      db,
    };
  }
  create(project: Project): Promise<void> {
    db;
  }
  get(projectId: ProjectId): Promise<Project> {}
  list(): Promise<Project[]> {}
  update(project: Project): Promise<void> {}
  delete(projectId: ProjectId): Promise<void> {}
}
