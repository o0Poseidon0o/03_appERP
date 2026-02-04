import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, message, Row, Col, Divider } from 'antd';
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
  const [users, setUsers] = useState<any[]>([]);       // List nhân viên (User hệ thống)
  const [factories, setFactories] = useState<any[]>([]);// List nhà máy
  const [parentDevices, setParentDevices] = useState<any[]>([]);

  useEffect(() => {
    if (open) {
        const fetchMasterData = async () => {
            try {
                // Gọi song song các API để lấy dữ liệu nạp vào Dropdown
                const [typeRes, userRes, factoryRes, pcRes] = await Promise.all([
                    assetService.getAssetTypes(),
                    axiosClient.get('/users?limit=1000'), 
                    axiosClient.get('/factories'),        
                    assetService.getAll({ search: '', limit: 100 }) // Lấy 100 PC gần nhất làm cha
                ]);

                setTypes(typeRes);
                setUsers(userRes.data.data?.users || userRes.data.data || []); 
                setFactories(factoryRes.data.data || []); 
                setParentDevices(pcRes.data.data);

            } catch (error) {
                console.error("Lỗi tải dữ liệu nguồn:", error);
            }
        };
        fetchMasterData();
    }
  }, [open]);

  useEffect(() => {
    if (open && initialValues) {
      // Map dữ liệu vào form
      form.setFieldsValue({
        ...initialValues,
        typeId: initialValues.typeId,
        factoryId: initialValues.factoryId,
        parentId: initialValues.parentId,
        status: initialValues.status,
        serialNumber: initialValues.serialNumber,
        
        // [MỚI] Map User Domain (User login trên máy)
        domainUser: initialValues.domainUser,

        // [QUAN TRỌNG] Map danh sách User quản lý (Relation N-N) thành mảng ID
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
      title={initialValues ? "Cập nhật thông tin tài sản" : "Thêm tài sản mới"}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={loading}
      width={850}
    >
      <Form form={form} layout="vertical" onFinish={onFinish}>
        
        {/* --- PHẦN 1: THÔNG TIN CƠ BẢN --- */}
        <Divider orientation="left" style={{ margin: '0 0 16px 0' }}>Thông tin thiết bị</Divider>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="name" label="Tên thiết bị (Hostname)" rules={[{ required: true, message: 'Vui lòng nhập tên máy' }]}>
              <Input placeholder="VD: PC-IT-01, LAPTOP-KETOAN..." />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="typeId" label="Loại thiết bị" rules={[{ required: true, message: 'Chọn loại thiết bị' }]}>
              <Select placeholder="Chọn loại...">
                {types.map(t => <Select.Option key={t.id} value={t.id}>{t.name}</Select.Option>)}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="serialNumber" label="Serial Number">
              <Input placeholder="Nhập số Serial..." />
            </Form.Item>
          </Col>
          <Col span={12}>
            {/* [MỚI] Trường Domain User */}
            <Form.Item 
                name="domainUser" 
                label="User Domain (Windows Account)" 
                tooltip="Tên tài khoản đang đăng nhập trên máy (VD: TOWA\NguyenVanA)"
            >
              <Input placeholder="VD: TOWA\Admin..." />
            </Form.Item>
          </Col>
        </Row>

        {/* --- PHẦN 2: QUẢN LÝ & VỊ TRÍ --- */}
        <Divider orientation="left" style={{ margin: '10px 0 16px 0' }}>Quản lý & Vị trí</Divider>
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

        <Row gutter={16}>
           <Col span={24}>
             {/* [QUAN TRỌNG] Dropdown User - Mode Multiple */}
             <Form.Item 
               name="userIds" 
               label="Người được biên chế sử dụng (Có thể chọn nhiều)" 
               tooltip="Chọn nhân viên chịu trách nhiệm quản lý máy này"
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

        <Row gutter={16}>
           <Col span={12}>
             <Form.Item name="parentId" label="Thiết bị cha (Nếu là linh kiện đi kèm)">
               <Select allowClear showSearch placeholder="Chọn PC quản lý..." optionFilterProp="children">
                 {parentDevices.map((pc: any) => (
                    <Select.Option key={pc.id} value={pc.id}>{pc.name}</Select.Option>
                 ))}
               </Select>
             </Form.Item>
           </Col>
        </Row>

        {/* Các field ẩn để giữ data nếu update */}
        <Form.Item name="customSpecs" hidden><Input /></Form.Item>
      </Form>
    </Modal>
  );
};

export default AssetForm;