// backend/src/routes/applicants.js
import express from 'express';
import { body, query, validationResult } from 'express-validator';
import pkg from 'csv-writer';
import verify from '../middleware/verifyToken.js';
import Applicant from '../models/Applicant.js';
import AuditLog from '../models/AuditLog.js';

const { createObjectCsvStringifier } = pkg;
const router = express.Router();

// Protect all routes
router.use(verify);

/**
 * Lists and rounds configuration
 */
const lists = {
  Physical: ["Running", "Pushups", "Situps"],
  GD: ["Group Discussion"],
  Interview: ["Interview"],
  "Final Merit": ["Final"]
};

// helper: ordered progression of lists
const listOrder = ["Physical", "GD", "Interview", "Final Merit"];

// GET /api/applicants/lists
router.get('/lists', async (_req, res) => {
  const out = Object.entries(lists).map(([name, rounds]) => ({ name, rounds }));
  res.json(out);
});

// POST /api/applicants
router.post(
  '/',
  body('name').isLength({ min: 2 }),
  body('uniqueCode').isLength({ min: 2 }),
  body('listName').isString(),
  body('contactNumber').optional().isLength({ min: 5 }),
  body('gender').optional().isString(),
  body('college').optional().isString(),
  body('branch').optional().isString(),
  body('year').optional().toInt().isInt({ min: 1, max: 10 }),
  body('marks.Physical').optional().isInt({ min: 0, max: 100 }),
  body('marks.GD').optional().isInt({ min: 0, max: 100 }),
  body('marks.Interview').optional().isInt({ min: 0, max: 100 }),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { name, uniqueCode, contactNumber, gender, college, branch, year, listName, notes, marks } = req.body;
      if (!lists[listName]) return res.status(400).json({ message: 'Unknown listName' });

      // Uniqueness per list
      const exists = await Applicant.findOne({ uniqueCode, listName });
      if (exists) return res.status(409).json({ message: 'Unique code already exists in this list' });

      const applicant = new Applicant({
        name,
        uniqueCode,
        contactNumber,
        gender,
        college,
        branch,
        year,
        notes,
        listName,
        marks: marks || { Physical: 0, GD: 0, Interview: 0 },
        auditLogs: [{
          action: 'CREATED',
          performedBy: req.user?.username,
          meta: { name, uniqueCode, listName }
        }]
      });

      await applicant.save().catch(err => {
        // Handle duplicate index error from compound index
        if (err?.code === 11000) {
          return res.status(409).json({ message: 'Unique code already exists in this list' });
        }
        throw err;
      });

      if (AuditLog?.create) {
        await AuditLog.create({
          action: 'CREATE_APPLICANT',
          entity: 'applicant',
          entityId: applicant._id.toString(),
          performedBy: req.user?.username,
          ip: req.ip,
          meta: { name, uniqueCode, listName }
        }).catch(() => {});
      }

      res.status(201).json(applicant);
    } catch (err) { next(err); }
  }
);

// GET /api/applicants/search
router.get('/search',
  query('q').optional().isString(),
  query('listName').optional().isString(),
  async (req, res, next) => {
    try {
      const q = req.query.q || '';
      const listName = req.query.listName;
      const filter = {};
      if (listName) filter.listName = listName;
      if (q) {
        filter.$or = [
          { name: new RegExp(q, 'i') },
          { uniqueCode: new RegExp(q, 'i') },
          { contactNumber: new RegExp(q, 'i') },
          { college: new RegExp(q, 'i') },
          { branch: new RegExp(q, 'i') },
          { email: new RegExp(q, 'i') }
        ];
      }
      const results = await Applicant.find(filter).sort({ createdAt: -1 }).limit(500);
      res.json(results);
    } catch (err) { next(err); }
  }
);

// NEW PROMOTE ROUTE
router.put('/:id/promote', async (req, res, next) => {
  try {
    const appl = await Applicant.findById(req.params.id);
    if (!appl) return res.status(404).json({ message: 'Applicant not found' });

    const currentIndex = listOrder.indexOf(appl.listName);
    if (currentIndex === -1 || currentIndex === listOrder.length - 1) {
      return res.status(400).json({ message: 'Cannot promote further' });
    }

    appl.listName = listOrder[currentIndex + 1];
    appl.round = 0; // reset round for new list

    appl.auditLogs.push({
      action: 'PROMOTED',
      performedBy: req.user?.username,
      meta: { from: listOrder[currentIndex], to: appl.listName }
    });

    await appl.save();

    if (AuditLog?.create) {
      await AuditLog.create({
        action: 'PROMOTE_APPLICANT',
        entity: 'applicant',
        entityId: appl._id.toString(),
        performedBy: req.user?.username,
        ip: req.ip,
        meta: { from: listOrder[currentIndex], to: appl.listName }
      }).catch(() => {});
    }

    res.json(appl);
  } catch (err) { next(err); }
});

// PUT /api/applicants/:id - Update applicant
router.put('/:id',
  body('name').optional().isLength({ min: 2 }),
  body('uniqueCode').optional().isLength({ min: 2 }),
  body('contactNumber').optional().isLength({ min: 5 }),
  body('gender').optional().isString(),
  body('college').optional().isString(),
  body('branch').optional().isString(),
  body('year').optional().toInt().isInt({ min: 1, max: 10 }),
  body('marks.Physical').optional().isInt({ min: 0, max: 100 }),
  body('marks.GD').optional().isInt({ min: 0, max: 100 }),
  body('marks.Interview').optional().isInt({ min: 0, max: 100 }),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const appl = await Applicant.findById(req.params.id);
      if (!appl) return res.status(404).json({ message: 'Applicant not found' });

      // Check if uniqueCode is being changed and if it already exists in this list
      if (req.body.uniqueCode && req.body.uniqueCode !== appl.uniqueCode) {
        const exists = await Applicant.findOne({ 
          uniqueCode: req.body.uniqueCode, 
          listName: appl.listName 
        });
        if (exists) return res.status(409).json({ message: 'Unique code already exists in this list' });
      }

      // Update fields
      const updateFields = ['name', 'uniqueCode', 'contactNumber', 'gender', 'college', 'branch', 'year', 'notes'];
      updateFields.forEach(field => {
        if (req.body[field] !== undefined) {
          appl[field] = req.body[field];
        }
      });

      // Update marks
      if (req.body.marks) {
        Object.keys(req.body.marks).forEach(markType => {
          if (req.body.marks[markType] !== undefined) {
            appl.marks[markType] = req.body.marks[markType];
          }
        });
      }

      // Add audit log
      appl.auditLogs.push({
        action: 'UPDATED',
        performedBy: req.user?.username,
        meta: { 
          name: appl.name, 
          uniqueCode: appl.uniqueCode, 
          listName: appl.listName,
          updatedFields: Object.keys(req.body).filter(key => key !== 'marks')
        }
      });

      await appl.save();

      if (AuditLog?.create) {
        await AuditLog.create({
          action: 'UPDATE_APPLICANT',
          entity: 'applicant',
          entityId: appl._id.toString(),
          performedBy: req.user?.username,
          ip: req.ip,
          meta: { name: appl.name, uniqueCode: appl.uniqueCode, listName: appl.listName }
        }).catch(() => {});
      }

      res.json(appl);
    } catch (err) { next(err); }
  }
);

// DELETE /api/applicants/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const appl = await Applicant.findById(req.params.id);
    if (!appl) return res.status(404).json({ message: 'Applicant not found' });

    await Applicant.deleteOne({ _id: appl._id });

    if (AuditLog?.create) {
      await AuditLog.create({
        action: 'DELETE_APPLICANT',
        entity: 'applicant',
        entityId: appl._id.toString(),
        performedBy: req.user?.username,
        ip: req.ip,
        meta: { name: appl.name, uniqueCode: appl.uniqueCode, listName: appl.listName }
      }).catch(() => {});
    }

    res.json({ success: true });
  } catch (err) { next(err); }
});

// GET /api/applicants/:id/audit
router.get('/:id/audit', async (req, res, next) => {
  try {
    const appl = await Applicant.findById(req.params.id);
    if (!appl) return res.status(404).json({ message: 'Not found' });
    res.json(appl.auditLogs || []);
  } catch (err) { next(err); }
});

// GET /api/applicants/export
router.get('/export', async (req, res, next) => {
  try {
    const listName = req.query.listName;
    const filter = {};
    if (listName) filter.listName = listName;

    const applicants = await Applicant.find(filter).sort({ createdAt: -1 });

    const csv = createObjectCsvStringifier({
      header: [
        { id: 'name', title: 'Name' },
        { id: 'uniqueCode', title: 'Unique Code' },
        { id: 'contactNumber', title: 'Contact Number' },
        { id: 'gender', title: 'Gender' },
        { id: 'college', title: 'College' },
        { id: 'branch', title: 'Branch' },
        { id: 'year', title: 'Year' },
        { id: 'marksPhysical', title: 'Physical Marks' },
        { id: 'marksGD', title: 'GD Marks' },
        { id: 'marksInterview', title: 'Interview Marks' },
        { id: 'totalMarks', title: 'Total Marks' },
        { id: 'round', title: 'Round' },
        { id: 'listName', title: 'List' },
        { id: 'notes', title: 'Notes' },
        { id: 'createdAt', title: 'Created At' }
      ]
    });

    const records = applicants.map(a => {
      const physical = a.marks?.Physical || 0;
      const gd = a.marks?.GD || 0;
      const interview = a.marks?.Interview || 0;
      const total = physical + gd + interview;
      
      return {
        name: a.name,
        uniqueCode: a.uniqueCode,
        contactNumber: a.contactNumber || '',
        gender: a.gender || '',
        college: a.college || '',
        branch: a.branch || '',
        year: a.year ?? '',
        marksPhysical: physical,
        marksGD: gd,
        marksInterview: interview,
        totalMarks: total,
        round: a.round ?? 0,
        listName: a.listName,
        notes: a.notes || '',
        createdAt: a.createdAt ? a.createdAt.toISOString() : ''
      };
    });

    const csvString = csv.getHeaderString() + csv.stringifyRecords(records);

    if (AuditLog?.create) {
      await AuditLog.create({
        action: 'EXPORT',
        entity: 'applicant',
        entityId: listName || 'ALL',
        performedBy: req.user?.username,
        ip: req.ip,
        meta: { count: applicants.length }
      }).catch(() => {});
    }

    res.setHeader('Content-Disposition', `attachment; filename=applicants_${listName || 'all'}_${Date.now()}.csv`);
    res.setHeader('Content-Type', 'text/csv');
    res.status(200).send(csvString);
  } catch (err) { next(err); }
});

export default router;
