import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, message, Row, Col } from 'antd'; 
import { assetService } from '../../services/assetService';
import axiosClient from '../../api/axiosClient';

interface AssetFormProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  initialValues?: any;
}

const AssetForm: React.FC<AssetFormProps> = ({ open, onCancel, onSuccess, initialValues }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  
  // State dữ liệu cho Dropdown
  const [types, setTypes] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);       
  const [factories, setFactories] = useState<any[]>([]);
  
  // [FIX] Đã xóa state 'parentDevices' vì không dùng đến

  // 1. Load danh mục
  useEffect(() => {
    if (open) {
        const fetchMasterData = async () => {
            try {
                // [FIX] Xóa phần load PC cha để tránh dư thừa
                const [typeRes, userRes, factoryRes] = await Promise.all([
                    assetService.getAssetTypes(),
                    axiosClient.get('/users?limit=1000'), 
                    axiosClient.get('/factories'),        
                ]);

                setTypes(typeRes.data.data || []); 
                setUsers(userRes.data.data?.users || userRes.data.data || []); 
                setFactories(factoryRes.data.data || []); 
            } catch (error) {
                console.error("Lỗi tải dữ liệu nguồn:", error);
            }
        };
        fetchMasterData();
    }
  }, [open]);

  // 2. Fill dữ liệu vào Form
  useEffect(() => {
    if (open && initialValues) {
      const specs = initialValues.customSpecs || {};

      form.setFieldsValue({
        ...initialValues,
        typeId: initialValues.typeId,
        factoryId: initialValues.factoryId,
        // parentId: initialValues.parentId, // [FIX] Đã xóa trường này
        status: initialValues.status,
        serialNumber: initialValues.serialNumber,
        domainUser: initialValues.domainUser,
        userIds: initialValues.users?.map((u: any) => u.id) || [], 
        
        manufacturer: initialValues.manufacturer,
        modelName: initialValues.modelName,
        osName: initialValues.osName,
        ipAddress: initialValues.ipAddress,
        macAddress: initialValues.macAddress,
        
        cpu: specs.cpu,
        ram: specs.ram,
        disk: specs.disk,
      });
    } else if (open && !initialValues) {
      form.resetFields();
    }
  }, [initialValues, open, form]);

  // 3. Xử lý trước khi Lưu
  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const payload = {
          ...values,
          customSpecs: {
              cpu: values.cpu,
              ram: values.ram,
              disk: values.disk,
              ...(initialValues?.customSpecs || {}) 
          }
      };

      if (initialValues?.id) {
        await assetService.update(initialValues.id, payload);
        message.success("Cập nhật thành công!");
      } else {
        await assetService.create(payload);
        message.success("Tạo mới thành công!");
      }
      onSuccess();
    } catch (error: any) {
      message.error(error.response?.data?.message || "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };

  const SectionTitle = ({ title }: { title: string }) => (
    <div className="flex items-center gap-3 mb-4 mt-2">
      <span className="text-blue-700 font-bold text-base uppercase tracking-wide whitespace-nowrap">
        {title}
      </span>
      <div className="h-px bg-gray-200 flex-1"></div>
    </div>
  );

  return (
    <Modal
      title={initialValues ? <span className="text-blue-600 font-bold">Cập nhật: {initialValues.name}</span> : "Thêm tài sản mới"}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={loading}
      width={900}
      maskClosable={false}
      style={{ top: 20 }}
    >
      <Form form={form} layout="vertical" onFinish={onFinish} className="pt-2">
        
        {/* --- PHẦN 1: THÔNG TIN CƠ BẢN --- */}
        <SectionTitle title="Thông tin chung" />
        
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="name" label="Hostname (Tên máy)" rules={[{ required: true, message: 'Bắt buộc nhập' }]}>
              <Input placeholder="VD: PC-IT-01..." />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="typeId" label="Loại thiết bị" rules={[{ required: true, message: 'Bắt buộc chọn' }]}>
              <Select placeholder="Chọn loại...">
                {types.map(t => <Select.Option key={t.id} value={t.id}>{t.name}</Select.Option>)}
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
             <Form.Item name="serialNumber" label="Serial Number">
              <Input placeholder="Số Serial..." />
            </Form.Item>
          </Col>
        </Row>

        {/* --- PHẦN 2: CHI TIẾT PHẦN CỨNG (NHẬP TAY) --- */}
        <SectionTitle title="Chi tiết Phần cứng (Nhập tay)" />
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4">
            <Row gutter={16}>
                <Col span={12}>
                    <Form.Item name="manufacturer" label="Hãng sản xuất">
                        <Input placeholder="VD: Dell, HP, Lenovo..." />
                    </Form.Item>
                </Col>
                <Col span={12}>
                    <Form.Item name="modelName" label="Tên Model">
                        <Input placeholder="VD: OptiPlex 3050..." />
                    </Form.Item>
                </Col>
            </Row>
            
            <Row gutter={16}>
                <Col span={12}>
                    <Form.Item name="cpu" label="CPU (Vi xử lý)">
                        <Input placeholder="VD: Intel Core i5-8500 @ 3.00GHz" />
                    </Form.Item>
                </Col>
                <Col span={6}>
                    <Form.Item name="ram" label="RAM">
                        <Input placeholder="VD: 16 GB" />
                    </Form.Item>
                </Col>
                <Col span={6}>
                    <Form.Item name="disk" label="Ổ cứng">
                        <Input placeholder="VD: 256GB SSD + 1TB HDD" />
                    </Form.Item>
                </Col>
            </Row>

            <Row gutter={16}>
                <Col span={8}>
                    <Form.Item name="osName" label="Hệ điều hành">
                        <Input placeholder="VD: Microsoft Windows 10 Pro" />
                    </Form.Item>
                </Col>
                <Col span={8}>
                    <Form.Item name="ipAddress" label="Địa chỉ IP (LAN)">
                        <Input placeholder="VD: 192.168.1.105" />
                    </Form.Item>
                </Col>
                <Col span={8}>
                    <Form.Item name="macAddress" label="Địa chỉ MAC">
                        <Input placeholder="VD: AA:BB:CC:11:22:33" />
                    </Form.Item>
                </Col>
            </Row>
        </div>

        {/* --- PHẦN 3: QUẢN LÝ & VỊ TRÍ --- */}
        <SectionTitle title="Quản lý & Vị trí" />

        <Row gutter={16}>
          <Col span={8}>
             <Form.Item name="factoryId" label="Nhà máy / Chi nhánh">
                <Select placeholder="Chọn nhà máy..." allowClear>
                    {factories.map((f: any) => (
                        <Select.Option key={f.id} value={f.id}>{f.name}</Select.Option>
                    ))}
                </Select>
             </Form.Item>
          </Col>
          <Col span={8}>
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
          <Col span={8}>
            <Form.Item name="domainUser" label="User Domain (Đang Login)">
              <Input placeholder="VD: TOWA\Admin..." />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
           <Col span={24}>
             <Form.Item 
               name="userIds" 
               label="Người được biên chế sử dụng (ITAM Assign)" 
             >
               <Select 
                 mode="multiple" 
                 allowClear 
                 showSearch 
                 placeholder="Tìm kiếm nhân viên..." 
                 optionFilterProp="children"
                 maxTagCount="responsive"
               >
                 {users.map((u: any) => (
                    <Select.Option key={u.id} value={u.id}>
                        {u.fullName} ({u.email})
                    </Select.Option>
                 ))}
               </Select>
             </Form.Item>
           </Col>
        </Row>
      </Form>
    </Modal>
  );
};

export default AssetForm;