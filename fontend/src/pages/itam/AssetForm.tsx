import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, message, Row, Col } from 'antd';
import { assetService } from '../../services/assetService';
import axiosClient from '../../api/axiosClient'; // Dùng client để gọi API User/Factory

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
  const [users, setUsers] = useState<any[]>([]);       // List nhân viên
  const [factories, setFactories] = useState<any[]>([]);// List nhà máy
  const [parentDevices, setParentDevices] = useState<any[]>([]);

  useEffect(() => {
    const fetchMasterData = async () => {
        try {
            // 1. Gọi song song các API để lấy dữ liệu nạp vào Dropdown
            // Lưu ý: Nếu API user của bạn có phân trang, hãy thêm ?limit=1000 để lấy hết
            const [typeRes, userRes, factoryRes, pcRes] = await Promise.all([
                assetService.getAssetTypes(),
                axiosClient.get('/users?limit=1000'), 
                axiosClient.get('/factories'),        
                assetService.getAll({ search: '', limit: 100 }) // Lấy PC mẹ (lấy 100 cái gần nhất)
            ]);

            setTypes(typeRes);
            
            // Xử lý dữ liệu trả về tùy theo cấu trúc API của bạn (data.data hoặc data)
            setUsers(userRes.data.data?.users || userRes.data.data || []); 
            setFactories(factoryRes.data.data || []); 
            setParentDevices(pcRes.data.data);

        } catch (error) {
            console.error("Lỗi tải dữ liệu nguồn:", error);
            // Không show error message để tránh làm phiền nếu chỉ lỗi 1 API phụ
        }
    };

    fetchMasterData();

    if (initialValues) {
      form.setFieldsValue({
        ...initialValues,
        typeId: initialValues.typeId,
        factoryId: initialValues.factoryId,
        parentId: initialValues.parentId,
        status: initialValues.status,
        serialNumber: initialValues.serialNumber,
        // [QUAN TRỌNG] Map mảng users thành mảng ID để hiển thị select multiple
        userIds: initialValues.users?.map((u: any) => u.id) || [], 
      });
    } else {
      form.resetFields();
    }
  }, [initialValues, form]);

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
      title={initialValues ? "Cập nhật tài sản" : "Thêm tài sản mới"}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={loading}
      width={800}
    >
      <Form form={form} layout="vertical" onFinish={onFinish}>
        {/* Hàng 1: Tên & Loại */}
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="name" label="Tên thiết bị (Hostname)" rules={[{ required: true, message: 'Vui lòng nhập tên máy' }]}>
              <Input placeholder="VD: PC80, LAPTOP-KETOAN..." />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="typeId" label="Loại thiết bị" rules={[{ required: true }]}>
              <Select placeholder="Chọn loại...">
                {types.map(t => <Select.Option key={t.id} value={t.id}>{t.name}</Select.Option>)}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        {/* Hàng 2: Vị trí & Trạng thái */}
        <Row gutter={16}>
          <Col span={12}>
             {/* [MỚI] Dropdown Nhà máy */}
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

        {/* Hàng 3: Người dùng (Chọn nhiều) */}
        <Row gutter={16}>
           <Col span={24}>
             {/* [MỚI] Dropdown User - Mode Multiple */}
             <Form.Item 
                name="userIds" 
                label="Người sử dụng (Có thể chọn nhiều)" 
                tooltip="Chọn những nhân viên được phép sử dụng máy này"
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

        {/* Hàng 4: Thiết bị cha & Serial */}
        <Row gutter={16}>
           <Col span={12}>
             <Form.Item name="parentId" label="Thuộc về máy (Nếu là thiết bị đi kèm)">
               <Select allowClear showSearch placeholder="Chọn PC quản lý..." optionFilterProp="children">
                 {parentDevices.map((pc: any) => (
                    <Select.Option key={pc.id} value={pc.id}>{pc.name}</Select.Option>
                 ))}
               </Select>
             </Form.Item>
           </Col>
           <Col span={12}>
            <Form.Item name="serialNumber" label="Serial Number">
              <Input placeholder="Nhập số Serial..." />
            </Form.Item>
          </Col>
        </Row>

        {/* Các field ẩn */}
        <Form.Item name="customSpecs" hidden><Input /></Form.Item>
      </Form>
    </Modal>
  );
};

export default AssetForm;