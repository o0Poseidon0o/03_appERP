// src/pages/Profile.tsx
import React, { useState, useEffect } from "react";
import {
  Card, Avatar, Tabs, Form, Input, Button, Row, Col, Tag,
  theme, App, Descriptions, Spin, Divider,
} from "antd";
import {
  UserOutlined, LockOutlined, SaveOutlined, DesktopOutlined,
  EnvironmentOutlined, ApartmentOutlined, LaptopOutlined, CloudServerOutlined,
  WindowsOutlined, GlobalOutlined, FundProjectionScreenOutlined
} from "@ant-design/icons";
import { useAuth } from "../contexts/AuthContext";
import axiosClient from "../api/axiosClient";

interface ProfileInfoValues {
  fullName: string;
}

interface ChangePasswordValues {
  currentPassword: string;
  newPassword: string;
}

const Profile: React.FC = () => {
  const { user, updateLocalUser } = useAuth();
  const { token } = theme.useToken();
  const { message } = App.useApp();

  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [fullUserInfo, setFullUserInfo] = useState<any>(null);
  const [userAssets, setUserAssets] = useState<any[]>([]);

  const [formInfo] = Form.useForm();
  const [formPassword] = Form.useForm();

  // --- 0. Fetch Dữ liệu User Chi Tiết ---
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user?.id) return;
      try {
        setFetchingData(true);

        // 1. [ĐÃ FIX 403] Không gọi API /users nữa, dùng luôn user từ AuthContext
        // User này đã chứa sẵn factory và department từ lúc login
        setFullUserInfo(user);

        // 2. Lấy danh sách máy tính CỦA TÔI (GỌI API MY-ASSETS - Không cần quyền)
        try {
            const assetRes = await axiosClient.get(`/assets/my-assets`);
            setUserAssets(assetRes.data?.data || []);
        } catch (assetErr) {
            console.error("Lỗi khi lấy tài sản cá nhân:", assetErr);
            setUserAssets([]);
        }

      } catch (error) {
        console.error("Lỗi hệ thống:", error);
      } finally {
        setFetchingData(false);
      }
    };

    fetchUserProfile();
  }, [user]);

  // --- 1. Xử lý cập nhật thông tin cá nhân ---
  const handleUpdateInfo = async (values: ProfileInfoValues) => {
    if (!user?.id) return;

    setLoading(true);
    try {
      // Gọi API dành riêng cho user tự sửa (Không bị lỗi 403)
      await axiosClient.patch(`/users/profile/me`, {
        fullName: values.fullName,
      });

      updateLocalUser({ fullName: values.fullName });
      message.success("Cập nhật thông tin thành công!");
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || "Có lỗi xảy ra khi cập nhật");
    } finally {
      setLoading(false);
    }
  };

  // --- 2. Xử lý đổi mật khẩu ---
  const handleChangePassword = async (values: ChangePasswordValues) => {
    setLoading(true);
    try {
      await axiosClient.post("/auth/change-password", {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });

      message.success("Đổi mật khẩu thành công! Vui lòng đăng nhập lại.");
      formPassword.resetFields();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || "Đổi mật khẩu thất bại");
    } finally {
      setLoading(false);
    }
  };

  const getDeviceIcon = (code?: string) => {
    if (code === 'LAPTOP') return <LaptopOutlined className="text-blue-600 mr-2" />;
    if (code === 'SERVER') return <CloudServerOutlined className="text-blue-600 mr-2" />;
    return <DesktopOutlined className="text-blue-600 mr-2" />;
  };

  if (fetchingData) {
    return (
      <div className="h-full flex justify-center items-center py-20">
        <Spin size="large" />
      </div>
    );
  }

  const items = [
    {
      key: "1",
      label: "Thông tin chung",
      children: (
        <div className="space-y-6">
          <Card type="inner" className="bg-gray-50 border border-gray-100">
            <Descriptions
              title={<span className="text-gray-700">Thông tin Biên chế</span>}
              column={{ xs: 1, sm: 2, md: 2 }}
              size="small"
            >
              <Descriptions.Item label={<span className="text-gray-500"><EnvironmentOutlined /> Nhà máy</span>}>
                <span className="font-medium text-slate-700">
                  {fullUserInfo?.factory?.name ? (
                    fullUserInfo.factory.name
                  ) : fullUserInfo?.roleId === "ROLE-ADMIN" ? (
                    <Tag color="purple" className="m-0 border-none">Quản trị toàn hệ thống</Tag>
                  ) : (
                    <span className="text-gray-400 italic">Chưa phân bổ</span>
                  )}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label={<span className="text-gray-500"><ApartmentOutlined /> Phòng ban</span>}>
                <span className="font-medium text-slate-700">
                  {fullUserInfo?.department?.name || <span className="text-gray-400 italic">Chưa phân bổ</span>}
                </span>
              </Descriptions.Item>
            </Descriptions>

            <Divider className="my-3" />

            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <DesktopOutlined className="text-blue-500" /> Tài sản IT được cấp phát:
            </h4>
            
            {userAssets.length > 0 ? (
              <div className="flex flex-col gap-4">
                {userAssets.map((asset: any) => {
                  let shortTypeName = asset.type?.name || 'Unknown';
                  const code = asset.type?.code;
                  if (code === 'PC') shortTypeName = 'Máy bàn (PC)';
                  else if (code === 'LAPTOP') shortTypeName = 'Laptop';
                  else if (code === 'SERVER') shortTypeName = 'Server';

                  const specs = asset.customSpecs || {};
                  const comps = asset.components || [];
                  const monitors = comps.filter((c: any) => c.type === 'MONITOR');
                  const peripherals = comps.filter((c: any) => ['MOUSE', 'KEYBOARD'].includes(c.type));

                  return (
                    <div key={asset.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-3 transition-all hover:border-blue-300 hover:shadow-md">
                      
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold text-blue-800 text-base flex items-center">
                            {getDeviceIcon(code)}
                            {asset.name}
                            <Tag color="cyan" bordered={false} className="ml-3 font-normal text-[11px]">
                                {shortTypeName}
                            </Tag>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {asset.manufacturer} {asset.modelName || "Không rõ model"} • SN: <span className="font-mono">{asset.serialNumber || "N/A"}</span>
                          </div>
                        </div>
                        <Tag color={asset.status === "IN_USE" ? "processing" : "default"} className="m-0 border-none font-medium">
                          {asset.status === "IN_USE" ? "Đang sử dụng" : asset.status}
                        </Tag>
                      </div>

                      <div className="h-px w-full bg-gray-100" />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[13px] text-slate-700">
                        <div className="flex flex-col gap-1.5">
                            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Mạng & Hệ điều hành</div>
                            {asset.osName ? (
                                <div className="flex items-center gap-2"><WindowsOutlined className="text-blue-500"/> {asset.osName}</div>
                            ) : <div className="text-gray-400 italic">Không rõ HĐH</div>}
                            
                            {asset.ipAddress && (
                                <div className="flex items-center gap-2 font-mono"><GlobalOutlined className="text-green-500"/> {asset.ipAddress}</div>
                            )}
                            {asset.macAddress && (
                                <div className="flex items-center gap-2 font-mono text-gray-500"><span className="w-3 text-center">🏷️</span> MAC: {asset.macAddress}</div>
                            )}
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Cấu hình Phần cứng</div>
                            {specs.cpu ? <div className="truncate" title={specs.cpu}><span className="font-semibold text-gray-500 w-10 inline-block">CPU:</span> {specs.cpu}</div> : null}
                            {specs.ram ? <div><span className="font-semibold text-gray-500 w-10 inline-block">RAM:</span> {specs.ram}</div> : null}
                            {specs.disk ? <div className="truncate" title={specs.disk}><span className="font-semibold text-gray-500 w-10 inline-block">Disk:</span> {specs.disk}</div> : null}
                            {Array.isArray(specs.gpus) && specs.gpus.length > 0 ? (
                                <div className="truncate" title={specs.gpus[0].Name}><span className="font-semibold text-gray-500 w-10 inline-block">GPU:</span> {specs.gpus[0].Name}</div>
                            ) : null}
                            {(!specs.cpu && !specs.ram && !specs.disk) && <div className="text-gray-400 italic">Chưa có thông tin phần cứng</div>}
                        </div>
                      </div>

                      {(monitors.length > 0 || peripherals.length > 0) && (
                         <>
                            <div className="h-px w-full bg-gray-100 border-dashed" />
                            <div className="flex flex-col gap-2 text-[13px] text-slate-700">
                               <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Màn hình & Phụ kiện kèm theo</div>
                               <div className="flex flex-wrap gap-x-6 gap-y-2">
                                  {monitors.map((m: any) => (
                                      <div key={m.id} className="flex items-center gap-2 bg-blue-50/50 px-2 py-1 rounded text-blue-800 border border-blue-100">
                                          <FundProjectionScreenOutlined /> 
                                          <span>{m.name} {m.specs?.size && m.specs.size !== 'N/A' ? `(${m.specs.size})` : ''}</span>
                                      </div>
                                  ))}
                                  {peripherals.map((p: any) => {
                                      const isMouse = p.type === 'MOUSE';
                                      const brand = p.specs?.brand && p.specs.brand !== 'Unknown' ? p.specs.brand : '';
                                      const cleanName = p.name.replace(brand, '').replace('Device', '').trim();
                                      return (
                                          <div key={p.id} className="flex items-center gap-2 bg-gray-50 px-2 py-1 rounded border border-gray-200">
                                              <span>{isMouse ? '🖱️' : '⌨️'}</span> 
                                              <span>{brand ? <b>{brand}</b> : ''} {cleanName}</span>
                                          </div>
                                      );
                                  })}
                               </div>
                            </div>
                         </>
                      )}

                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-gray-400 italic bg-white p-6 rounded-xl border border-dashed border-gray-200 flex flex-col items-center justify-center gap-2">
                <DesktopOutlined className="text-3xl text-gray-200" />
                <span>Bạn chưa được cấp phát thiết bị nào trên hệ thống.</span>
              </div>
            )}
          </Card>

          <Form layout="vertical" form={formInfo} initialValues={{ fullName: fullUserInfo?.fullName }} onFinish={handleUpdateInfo}>
            <Row gutter={24}>
              <Col span={24}>
                <Form.Item
                  label={<span className="font-medium text-gray-700">Tên hiển thị (Họ và tên)</span>}
                  name="fullName"
                  rules={[{ required: true, message: "Vui lòng nhập họ tên" }]}
                >
                  <Input prefix={<UserOutlined className="text-gray-400" />} placeholder="Nhập họ tên" size="large" className="rounded-lg"/>
                </Form.Item>
              </Col>
            </Row>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading} size="large" className="rounded-lg">
              Lưu thay đổi
            </Button>
          </Form>
        </div>
      ),
    },
    {
      key: "2",
      label: "Đổi mật khẩu",
      children: (
        <Form layout="vertical" form={formPassword} onFinish={handleChangePassword} className="pt-2">
          <Form.Item label={<span className="font-medium text-gray-700">Mật khẩu hiện tại</span>} name="currentPassword" rules={[{ required: true, message: "Vui lòng nhập mật khẩu hiện tại" }]}>
            <Input.Password prefix={<LockOutlined className="text-gray-400" />} size="large" className="rounded-lg" />
          </Form.Item>
          <Form.Item label={<span className="font-medium text-gray-700">Mật khẩu mới</span>} name="newPassword" rules={[{ required: true, message: "Vui lòng nhập mật khẩu mới" }, { min: 6, message: "Mật khẩu tối thiểu 6 ký tự" }]}>
            <Input.Password prefix={<LockOutlined className="text-gray-400" />} size="large" className="rounded-lg" />
          </Form.Item>
          <Form.Item label={<span className="font-medium text-gray-700">Xác nhận mật khẩu mới</span>} name="confirmPassword" dependencies={["newPassword"]} rules={[
              { required: true, message: "Vui lòng xác nhận lại mật khẩu" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("newPassword") === value) return Promise.resolve();
                  return Promise.reject(new Error("Mật khẩu xác nhận không khớp!"));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined className="text-gray-400" />} size="large" className="rounded-lg" />
          </Form.Item>
          <Button type="primary" danger htmlType="submit" loading={loading} size="large" className="rounded-lg mt-2">
            Cập nhật mật khẩu
          </Button>
        </Form>
      ),
    },
  ];

  return (
    <div className="max-w-5xl mx-auto py-4">
      <h2 className="text-2xl font-bold mb-6 text-slate-800">Thiết lập tài khoản</h2>
      <Row gutter={[24, 24]}>
        <Col xs={24} md={8}>
          <Card className="text-center shadow-sm h-full rounded-2xl" style={{ background: token.colorBgContainer }} bordered={false}>
            <div className="flex flex-col items-center py-4">
              <Avatar size={110} src={`https://ui-avatars.com/api/?name=${fullUserInfo?.fullName || user?.fullName}&background=random&size=128`} className="mb-5 shadow-sm" />
              <h3 className="text-xl font-bold text-slate-800 mb-1">{fullUserInfo?.fullName || user?.fullName}</h3>
              <p className="text-gray-500 mb-4">{fullUserInfo?.email || user?.email}</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Tag color="blue" className="px-3 py-1 rounded-full border-none font-medium">{fullUserInfo?.role?.name || user?.role?.name || "User"}</Tag>
                <Tag color="cyan" className="px-3 py-1 rounded-full border-none font-mono">{user?.id}</Tag>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} md={16}>
          <Card className="shadow-sm h-full rounded-2xl" style={{ background: token.colorBgContainer }} bordered={false} bodyStyle={{ padding: "12px 24px 24px" }}>
            <Tabs defaultActiveKey="1" items={items} />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Profile;