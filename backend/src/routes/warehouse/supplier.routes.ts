import express from 'express';
import * as supplierController from '../../controllers/warehouse/supplier.controller';
import { protect, hasPermission } from '../../middlewares/authMiddleware';

const router = express.Router();

router.use(protect);

router.get('/', hasPermission('WMS_VIEW'), supplierController.getAllSuppliers);
router.post('/', hasPermission('ITEM_CREATE'), supplierController.createSupplier);
router.patch('/:id', hasPermission('ITEM_UPDATE'), supplierController.updateSupplier);
router.delete('/:id', hasPermission('ITEM_DELETE'), supplierController.deleteSupplier);

export default router;