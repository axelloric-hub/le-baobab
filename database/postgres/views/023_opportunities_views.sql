CREATE OR REPLACE VIEW v_job_statistics AS
SELECT j.id AS job_id, j.title, j.status, j.company_id,
       count(a.id) AS applications,
       count(a.id) FILTER (WHERE a.status = 'shortlisted') AS shortlisted,
       count(a.id) FILTER (WHERE a.status = 'interview') AS in_interview,
       count(a.id) FILTER (WHERE a.status = 'hired') AS hired
  FROM jobs_job j LEFT JOIN jobs_application a ON a.job_id = j.id
 GROUP BY j.id;

CREATE OR REPLACE VIEW v_company_statistics AS
SELECT c.id AS company_id, c.name, c.status,
       (SELECT count(*) FROM companies_member m WHERE m.company_id = c.id) AS members,
       (SELECT count(*) FROM jobs_job j WHERE j.company_id = c.id AND j.status = 'open') AS open_jobs,
       (SELECT count(*) FROM jobs_application a JOIN jobs_job j ON j.id = a.job_id WHERE j.company_id = c.id) AS applications_received
  FROM companies_company c;
