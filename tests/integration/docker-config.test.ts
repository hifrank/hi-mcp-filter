import path from 'path';
import fs from 'fs';

describe('Docker Configuration', () => {
  it('should have Dockerfile in root', () => {
    const dockerfilePath = path.join(process.cwd(), 'Dockerfile');
    expect(fs.existsSync(dockerfilePath)).toBe(true);
  });

  it('should have docker-compose.yml', () => {
    const composePath = path.join(process.cwd(), 'docker-compose.yml');
    expect(fs.existsSync(composePath)).toBe(true);
  });

  it('should have health-check script', () => {
    const healthCheckPath = path.join(process.cwd(), 'docker', 'health-check.sh');
    expect(fs.existsSync(healthCheckPath)).toBe(true);
  });

  it('should have docker config file', () => {
    const configPath = path.join(process.cwd(), 'config', 'docker.json');
    expect(fs.existsSync(configPath)).toBe(true);

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config.server.port).toBe(8080);
    expect(config.mcpServers).toBeDefined();
  });
});
