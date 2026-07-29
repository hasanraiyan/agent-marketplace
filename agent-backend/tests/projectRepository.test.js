import { jest } from '@jest/globals';
import projectRepository from '../src/modules/projects/project.repository.js';
import Project from '../src/modules/projects/project.model.js';

describe('Project Repository', () => {
  let mockProject;
  let mockCreatorId;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCreatorId = '507f1f77bcf86cd799439011';
    mockProject = {
      _id: '507f1f77bcf86cd799439099',
      name: 'Beyond Campus',
      description: '',
      status: 'ACTIVE',
      createdBy: mockCreatorId,
      createdAt: new Date(),
      updatedAt: new Date(),
      save: jest.fn(),
    };
    mockProject.save.mockResolvedValue(mockProject);
  });

  describe('create', () => {
    test('creates a Project via save()', async () => {
      const saveSpy = jest.spyOn(Project.prototype, 'save').mockResolvedValue(mockProject);

      const result = await projectRepository.create({
        name: 'Beyond Campus',
        createdBy: mockCreatorId,
      });

      expect(saveSpy).toHaveBeenCalled();
      expect(result).toEqual(mockProject);
    });
  });

  describe('findById', () => {
    test('finds a Project by id', async () => {
      jest.spyOn(Project, 'findById').mockResolvedValue(mockProject);

      const result = await projectRepository.findById(mockProject._id);

      expect(Project.findById).toHaveBeenCalledWith(mockProject._id);
      expect(result).toEqual(mockProject);
    });
  });

  describe('findBySlug', () => {
    test('finds a Project by slug', async () => {
      jest.spyOn(Project, 'findOne').mockResolvedValue(mockProject);

      const result = await projectRepository.findBySlug('beyond-campus');

      expect(Project.findOne).toHaveBeenCalledWith({ slug: 'beyond-campus' });
      expect(result).toEqual(mockProject);
    });
  });

  describe('updateMetadata', () => {
    test('updates metadata fields and returns the new document', async () => {
      const updated = { ...mockProject, name: 'Beyond Campus Inc.' };
      jest.spyOn(Project, 'findByIdAndUpdate').mockResolvedValue(updated);

      const result = await projectRepository.updateMetadata(mockProject._id, {
        name: 'Beyond Campus Inc.',
      });

      expect(Project.findByIdAndUpdate).toHaveBeenCalledWith(
        mockProject._id,
        { name: 'Beyond Campus Inc.' },
        { new: true, runValidators: true }
      );
      expect(result).toEqual(updated);
    });
  });

  describe('updateStatus', () => {
    test('sets status and any extra fields together', async () => {
      const updated = { ...mockProject, status: 'SUSPENDED' };
      jest.spyOn(Project, 'findByIdAndUpdate').mockResolvedValue(updated);

      const result = await projectRepository.updateStatus(mockProject._id, 'SUSPENDED', {
        suspendedAt: expect.any(Date),
      });

      expect(Project.findByIdAndUpdate).toHaveBeenCalledWith(
        mockProject._id,
        { $set: { status: 'SUSPENDED', suspendedAt: expect.any(Date) } },
        { new: true, runValidators: true }
      );
      expect(result).toEqual(updated);
    });
  });
});
