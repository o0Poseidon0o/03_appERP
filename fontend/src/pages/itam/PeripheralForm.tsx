import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, message, Row, Col } from 'antd'; 
import { assetService } from '../../services/assetService';
import axiosClient from '../../api/axiosClient';

interface PeripheralFormProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  initialValues?: any;
}

const PeripheralForm: React.FC<PeripheralFormProps> = ({ open, onCancel, onSuccess, initialValues }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  
  // State dữ liệu
  const [peripheralTypes, setPeripheralTypes] = useState<any[]>([]);
  const [parentDevices, setParentDevices] = useState<any[]>([]); // Danh sách PC/Laptop để chọn làm cha
  const [factories, setFactories] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    if (open) {
        const fetchMasterData = async () => {
            try {
                // 1. Lấy danh sách loại và LỌC BỎ PC/Laptop
                const typeRes = await assetService.getAssetTypes();
                const allTypes = typeRes.data.data || [];
                const pTypes = allTypes.filter((t: any) => !['PC', 'LAPTOP', 'SERVER'].includes(t.code));
                setPeripheralTypes(pTypes);

                // 2. Lấy danh sách PC/Laptop để làm thiết bị cha
                // Lưu ý: limit lớn để lấy hết
                const assetRes = await assetService.getAll({ limit: 1000 });
                const allAssets = assetRes.data.data || [];
                const parents = allAssets.filter((a: any) => ['PC', 'LAPTOP', 'SERVER'].includes(a.type?.code));
                setParentDevices(parents);

                // 3. Lấy vị trí & user
                const [factoryRes, userRes] = await Promise.all([
                    axiosClient.get('/factories'),
                    axiosClient.get('/users?limit=1000')
                ]);
                setFactories(factoryRes.data.data || []);
                setUsers(userRes.data.data?.users || userRes.data.data || []);

            } catch (error) {
                console.error("Lỗi tải dữ liệu nguồn:", error);
            }
        };
        fetchMasterData();
    }
  }, [open]);

  useEffect(() => {
    if (open && initialValues) {
      form.setFieldsValue({
        ...initialValues,
        typeId: initialValues.typeId,
        factoryId: initialValues.factoryId,
        parentId: initialValues.parentId, // ID của máy cha
        status: initialValues.status,
        serialNumber: initialValues.serialNumber,
        userIds: initialValues.users?.map((u: any) => u.id) || [], 
      });
    } else if (open && !initialValues) {
      form.resetFields();
    }
  }, [initialValues, open, form]);

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      if (initialValues?.id) {
        await assetService.update(initialValues.id, values);
        message.success("Cập nhật thành công!");
      } else {
        await assetService.create(values);
        message.success("Tạo mới thành công!");
      }
      onSuccess();
    } catch (error: any) {
      message.error(error.response?.data?.message || "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={initialValues ? "Cập nhật thiết bị ngoại vi" : "Thêm thiết bị ngoại vi"}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={loading}
      width={700}
      maskClosable={false}
    >
      <Form form={form} layout="vertical" onFinish={onFinish} className="pt-2">
        
        {/* --- Dòng 1: Tên & Loại --- */}
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="name" label="Tên thiết bị / Mã tài sản" rules={[{ required: true, message: 'Vui lòng nhập tên' }]}>
              <Input placeholder="VD: MOUSE-LOGITECH-01" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="typeId" label="Loại thiết bị" rules={[{ required: true, message: 'Chọn loại thiết bị' }]}>
              <Select placeholder="Chọn loại...">
                {peripheralTypes.map(t => <Select.Option key={t.id} value={t.id}>{t.name}</Select.Option>)}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        {/* --- Dòng 2: Model & Serial --- */}
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="modelName" label="Model (Dòng máy)">
              <Input placeholder="VD: Dell P2419H" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="serialNumber" label="Serial Number (S/N)">
              <Input placeholder="Nhập số Serial..." />
            </Form.Item>
          </Col>
        </Row>

        {/* --- Dòng 3: Quan trọng nhất - THIẾT BỊ CHA --- */}
        <div className="bg-blue-50 p-3 rounded mb-4 border border-blue-100">
            <Form.Item 
                name="parentId" 
                label={<span className="font-semibold text-blue-800">Đang gắn vào máy nào? (Thiết bị cha)</span>} 
                className="mb-0"
                tooltip="Chọn máy tính mà thiết bị này đang được cắm vào. Nếu để trống nghĩa là thiết bị rời/trong kho."
            >
               <Select allowClear showSearch placeholder="Tìm kiếm PC/Laptop quản lý..." optionFilterProp="children">
                 {parentDevices.map((pc: any) => (
                    <Select.Option key={pc.id} value={pc.id}>
                        🖥️ {pc.name} ({pc.users?.[0]?.fullName || 'Chưa gán user'})
                    </Select.Option>
                 ))}
               </Select>
            </Form.Item>
        </div>

        {/* --- Dòng 4: Vị trí & Trạng thái --- */}
        <Row gutter={16}>
          <Col span={12}>
             <Form.Item name="factoryId" label="Nhà máy / Chi nhánh">
                <Select placeholder="Chọn nhà máy..." allowClear>
                    {factories.map((f: any) => (
                        <Select.Option key={f.id} value={f.id}>{f.name}</Select.Option>
                    ))}
                </Select>
             </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="status" label="Trạng thái" initialValue="NEW">
              <Select>
                <Select.Option value="NEW">Mới nhập</Select.Option>
                <Select.Option value="IN_USE">Đang sử dụng</Select.Option>
                <Select.Option value="BROKEN">Hỏng / Lỗi</Select.Option>
                <Select.Option value="REPAIR">Đang sửa chữa</Select.Option>
                <Select.Option value="DISPOSED">Đã thanh lý</Select.Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        {/* --- Dòng 5: Người dùng (Optional) --- */}
        <Form.Item name="userIds" label="Người sử dụng trực tiếp (Nếu không gắn vào máy cha)">
            <Select mode="multiple" allowClear showSearch placeholder="Tìm nhân viên..." optionFilterProp="children" maxTagCount="responsive">
                {users.map((u: any) => (
                <Select.Option key={u.id} value={u.id}>{u.fullName} ({u.email})</Select.Option>
                ))}
            </Select>
        </Form.Item>

      </Form>
    </Modal>
  );
};

export default PeripheralForm;