import React, { useState, useEffect, useCallback } from "react";
import {
  Table,
  Card,
  Button,
  Select,
  InputNumber,
  Space,
  Form,
  Input,
  Row,
  Col,
  App as AntdApp,
  Typography,
  Divider,
  Alert,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  QrcodeOutlined,
  SwapOutlined,
  InfoCircleOutlined,
  ShopOutlined,
  SendOutlined,
  NodeIndexOutlined,
} from "@ant-design/icons";
import axiosClient from "../../api/axiosClient";
import { useNavigate } from "react-router-dom";
import QRScannerModal from "./QRScannerModal";

const { Text, Title } = Typography;

// --- INTERFACES ---
interface ItemConversion {
  unitName: string;
  factor: number;
}

interface Item {
  id: string;
  itemCode: string;
  itemName: string;
  baseUnit: string;
  conversions?: ItemConversion[];
}

interface Location {
  id: string;
  locationCode: string;
}

interface Supplier {
  id: string;
  name: string;
}

interface UsageCategory {
  id: string;
  code: string;
  name: string;
}

// Interface Workflow từ Backend
interface Workflow {
  id: string;
  name: string;
  code: string;
  targetType: string;
  isActive: boolean;
  allowedInitiatorRoles: string[];
}

interface TransactionDetail {
  key: string;
  itemId: string | null;
  inputQuantity: number;
  selectedUnit: string;
  conversionFactor: number;
  quantity: number;
  fromLocationId: string | null;
  toLocationId: string | null;
  usageCategoryId: string | null;
  currentStock?: number;
  physicalStock?: number;
  sourceFactoryId?: string; 
  sourceFactoryName?: string;
}

const StockTransactionCreate: React.FC = () => {
  const { message, notification } = AntdApp.useApp();
  const [form] = Form.useForm();
  const navigate = useNavigate();

  // Lấy thông tin User hiện tại
  const userStr = localStorage.getItem("user");
  const currentUser = userStr ? JSON.parse(userStr) : {};
  const currentRoleId = currentUser.roleId || "";

  // States
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [usageCategories, setUsageCategories] = useState<UsageCategory[]>([]);
  
  // State Workflow
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [availableWorkflows, setAvailableWorkflows] = useState<Workflow[]>([]);
  
  const [selectedItems, setSelectedItems] = useState<TransactionDetail[]>([]);
  const [rowLocationOptions, setRowLocationOptions] = useState<Record<string, any[]>>({});
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [detectedFactory, setDetectedFactory] = useState<{id: string, name: string} | null>(null);

  const transactionType = Form.useWatch("type", form);

  // 1. FETCH MASTER DATA
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const [resItems, resLocs, resSups, resUsage, resWorkflows] =
          await Promise.all([
            axiosClient.get("/items"),
            axiosClient.get("/warehouses/locations/all"),
            axiosClient.get("/suppliers"),
            axiosClient.get("/items/usage-categories"),
            axiosClient.get("/workflows"),
          ]);

        setItems(resItems.data?.data || []);
        setLocations(resLocs.data?.data || []);
        setSuppliers(resSups.data?.data || []);
        setUsageCategories(resUsage.data?.data || []);
        setWorkflows(resWorkflows.data?.data || []);
      } catch (error) {
        console.error("Lỗi tải dữ liệu nguồn:", error);
      }
    };
    fetchMasterData();
  }, []);

  // 2. XỬ LÝ LOGIC LỌC WORKFLOW
  const handleTypeChange = (value: string) => {
    setSelectedItems([]);
    setRowLocationOptions({});
    setDetectedFactory(null); 
    form.setFieldsValue({ workflowId: undefined });

    // Lọc sơ bộ: Chỉ lấy Workflow thuộc nhóm STOCK và đang Active
    const stockWorkflows = workflows.filter(w => w.targetType === 'STOCK' && w.isActive);

    // Lọc theo Role (Quyền tạo)
    const roleFiltered = stockWorkflows.filter((w) => {
        if (currentRoleId === "ROLE-ADMIN") return true;
        if (w.allowedInitiatorRoles && w.allowedInitiatorRoles.length > 0) {
           return w.allowedInitiatorRoles.includes(currentRoleId);
        }
        return true; 
    });

    // [THÔNG MINH] Lọc theo tên quy trình (Import vs Export)
    let suggestedWorkflows = roleFiltered;
    
    if (value === "IMPORT") {
        // Nếu chọn Nhập kho -> Tìm các quy trình có chữ "Nhập" hoặc "Import"
        suggestedWorkflows = roleFiltered.filter(w => 
            w.name.toLowerCase().includes("nhập") || 
            w.name.toLowerCase().includes("import") || 
            w.code.includes("IMPORT")
        );
    } else if (value === "EXPORT") {
        // Nếu chọn Xuất kho -> Tìm các quy trình có chữ "Xuất" hoặc "Export"
        suggestedWorkflows = roleFiltered.filter(w => 
            w.name.toLowerCase().includes("xuất") || 
            w.name.toLowerCase().includes("export") || 
            w.code.includes("EXPORT")
        );
    }

    // Nếu không tìm thấy gợi ý nào thì hiện tất cả để user tự chọn (Fallback)
    const finalOptions = suggestedWorkflows.length > 0 ? suggestedWorkflows : roleFiltered;
    
    setAvailableWorkflows(finalOptions);

    // Auto select nếu chỉ có 1 option duy nhất
    if (finalOptions.length === 1) {
      form.setFieldsValue({ workflowId: finalOptions[0].id });
    }
  };

  const addRow = () => {
    const newKey = `row_${Date.now()}`;
    setSelectedItems((prev) => [
      ...prev,
      {
        key: newKey,
        itemId: null,
        inputQuantity: 1,
        selectedUnit: "",
        conversionFactor: 1,
        quantity: 1,
        fromLocationId: null,
        toLocationId: null,
        usageCategoryId: null,
        currentStock: undefined,
      },
    ]);
  };

  const removeRow = (key: string) => {
    setSelectedItems((prev) => {
        const newItems = prev.filter((item) => item.key !== key);
        if (newItems.length === 0) {
            setDetectedFactory(null);
        } else {
            const firstWithFactory = newItems.find(i => i.sourceFactoryId);
            if (firstWithFactory) {
                setDetectedFactory({ 
                    id: firstWithFactory.sourceFactoryId!, 
                    name: firstWithFactory.sourceFactoryName! 
                });
            } else {
                setDetectedFactory(null);
            }
        }
        return newItems;
    });
    setRowLocationOptions((prev) => {
      const newOptions = { ...prev };
      delete newOptions[key];
      return newOptions;
    });
  };

  const getAvailableStockForLine = (record: TransactionDetail) => {
    if (transactionType === "IMPORT" || record.currentStock === undefined)
      return 999999;
    const usedInOtherLines = selectedItems.reduce((total, item) => {
      if (
        item.key !== record.key &&
        item.itemId === record.itemId &&
        item.fromLocationId === record.fromLocationId
      ) {
        return total + (item.quantity || 0);
      }
      return total;
    }, 0);
    const available = record.currentStock - usedInOtherLines;
    return available > 0 ? available : 0;
  };

  const fetchStockLocationsForItem = async (rowKey: string, itemId: string) => {
    try {
      if (!itemId) return;
      const res = await axiosClient.get("/stock-transactions/actual", {
        params: { itemId: itemId, limit: 500, ignoreFactoryScope: true },
      });
      const stocks = res.data.data || []; 
      const selectedItem = items.find((i) => i.id === itemId);
      const options = stocks.map((s: any) => ({
        value: s.locationId,
        label: `[${s.factoryName || 'Kho'}] ${s.locationCode} (Tồn: ${s.quantity} ${selectedItem?.baseUnit || ""})`,
        quantity: s.quantity,
        factoryId: s.factoryId,     
        factoryName: s.factoryName  
      }));
      setRowLocationOptions((prev) => ({ ...prev, [rowKey]: options }));
    } catch (error) {
      console.error("Lỗi lấy vị trí tồn kho:", error);
    }
  };

  const updateRow = async (
    key: string,
    field: keyof TransactionDetail | "unitChange",
    value: any,
  ) => {
    setSelectedItems((prevItems) => {
      const newData = [...prevItems];
      const index = newData.findIndex((item) => item.key === key);
      if (index > -1) {
        const row = { ...newData[index] };
        
        if (field === "itemId") {
          const selectedItem = items.find((i) => i.id === value);
          row.itemId = value;
          if (selectedItem) {
            row.selectedUnit = selectedItem.baseUnit;
            row.conversionFactor = 1;
            row.inputQuantity = 1;
            row.quantity = 1;
          }
          row.fromLocationId = null;
          row.sourceFactoryId = undefined;
          row.sourceFactoryName = undefined;
          row.currentStock = undefined;
          row.physicalStock = undefined;
          
          if (["EXPORT", "TRANSFER"].includes(transactionType))
            fetchStockLocationsForItem(key, value);

        } else if (field === "fromLocationId") {
            row.fromLocationId = value;
            const options = rowLocationOptions[key] || [];
            const selectedOpt = options.find(o => o.value === value);
            
            if (selectedOpt && selectedOpt.factoryId) {
                row.sourceFactoryId = selectedOpt.factoryId;
                row.sourceFactoryName = selectedOpt.factoryName;

                if (!detectedFactory) {
                    setDetectedFactory({ 
                        id: selectedOpt.factoryId, 
                        name: selectedOpt.factoryName 
                    });
                    message.info(`Hệ thống ghi nhận xuất hàng từ: ${selectedOpt.factoryName}`);
                } else if (detectedFactory.id !== selectedOpt.factoryId) {
                    message.warning(`Lưu ý: Bạn đang chọn hàng từ ${selectedOpt.factoryName}, khác với ${detectedFactory.name} của các dòng trước!`);
                }
            }
        } else if (field === "inputQuantity") {
          row.inputQuantity = value;
          row.quantity = value * row.conversionFactor;
        } else if (field === "unitChange") {
          const selectedItem = items.find((i) => i.id === row.itemId);
          if (selectedItem) {
            row.selectedUnit = value;
            if (value === selectedItem.baseUnit) row.conversionFactor = 1;
            else {
              const conversion = selectedItem.conversions?.find((c) => c.unitName === value);
              row.conversionFactor = conversion ? conversion.factor : 1;
            }
            row.quantity = row.inputQuantity * row.conversionFactor;
          }
        } else {
          (row as any)[field] = value;
        }

        if (transactionType !== "IMPORT" && row.itemId && row.fromLocationId) {
             axiosClient.get("/stock-transactions/check-stock", {
                params: { itemId: row.itemId, locationId: row.fromLocationId },
              }).then((res) => {
                setSelectedItems((current) => {
                  const idx = current.findIndex((i) => i.key === key);
                  if (idx > -1) {
                    const updated = [...current];
                    updated[idx].currentStock = res.data.quantity;
                    updated[idx].physicalStock = res.data.physical;
                    return updated;
                  }
                  return current;
                });
              });
        }
        newData[index] = row;
        return newData;
      }
      return prevItems;
    });
  };

  const handleScanSuccess = useCallback((decodedText: string) => { 
      const foundItem = items.find((i) => i.itemCode.toLowerCase() === decodedText.toLowerCase() || i.itemName.toLowerCase().includes(decodedText.toLowerCase()));
      if (foundItem) {
        const newKey = `row_qr_${Date.now()}`;
        const newRow: TransactionDetail = {
          key: newKey, itemId: foundItem.id, inputQuantity: 1, selectedUnit: foundItem.baseUnit,
          conversionFactor: 1, quantity: 1, fromLocationId: null, toLocationId: null, usageCategoryId: null, currentStock: undefined,
        };
        if (["EXPORT", "TRANSFER"].includes(transactionType)) fetchStockLocationsForItem(newKey, foundItem.id);
        setSelectedItems((prev) => [...prev, newRow]);
        message.success(`Đã thêm: ${foundItem.itemCode}`);
        setIsScannerOpen(false);
      } else {
        message.warning(`Không tìm thấy mã: ${decodedText}`);
      }
  }, [items, transactionType]); 

  useEffect(() => { 
    let barcodeBuffer = ""; let lastKeyTime = Date.now();
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      const currentTime = Date.now();
      if (currentTime - lastKeyTime > 100) barcodeBuffer = "";
      lastKeyTime = currentTime;
      if (e.key === "Enter") {
        if (barcodeBuffer.length > 0) { handleScanSuccess(barcodeBuffer); barcodeBuffer = ""; e.preventDefault(); }
      } else if (e.key.length === 1) barcodeBuffer += e.key;
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [handleScanSuccess]);

  // =================================================================
  // 3. HÀM SUBMIT (ĐÃ SỬA ĐỂ GỬI ĐỦ DATA CHO BACKEND)
  // =================================================================
  const onFinish = async (values: any) => {
    // 1. Validation cơ bản
    if (selectedItems.length === 0) return message.error("Vui lòng thêm ít nhất một vật tư!");
    
    // [FIX] Bắt buộc chọn quy trình với mọi loại phiếu
    if (!values.workflowId) return message.error("Vui lòng chọn quy trình xử lý!");

    // Validate Factory
    let finalTargetFactoryId = null;
    if (["EXPORT", "TRANSFER"].includes(transactionType)) {
        // Logic cũ: Lấy từ kho xuất
        const usedFactoryIds = [...new Set(selectedItems.map(i => i.sourceFactoryId).filter(Boolean))];
        if (usedFactoryIds.length === 0) return message.error("Vui lòng chọn vị trí kho xuất hàng!");
        if (usedFactoryIds.length > 1) return message.error("Lỗi: Một phiếu chỉ được xuất từ 1 Nhà máy. Vui lòng tách phiếu!");
        finalTargetFactoryId = usedFactoryIds[0];
    } else {
        // [FIX] Nhập kho: Lấy Factory của user đang đăng nhập
        if (!currentUser.factoryId) return message.error("Tài khoản của bạn chưa được gán vào Nhà máy nào để nhập kho!");
        finalTargetFactoryId = currentUser.factoryId;
    }

    for (const item of selectedItems) {
      if (!item.itemId) return message.error("Thiếu thông tin vật tư");
      if (item.quantity <= 0) return message.error("Số lượng sai");
      if (["EXPORT", "TRANSFER"].includes(transactionType) && !item.fromLocationId) return message.error("Thiếu kho nguồn");
      const available = getAvailableStockForLine(item);
      if (transactionType !== "IMPORT" && item.quantity > available) return message.error(`Vật tư dòng ${selectedItems.indexOf(item) + 1} vượt quá tồn kho!`);
    }

    setLoading(true);
    try {
      // Tìm mã code từ ID người dùng chọn
      const selectedWorkflow = workflows.find(w => w.id === values.workflowId);
      
      const payload = {
        workflowCode: selectedWorkflow?.code, // Gửi mã quy trình lên server
        
        transactionData: {
            type: values.type,
            description: values.description,
            isEmergency: values.isEmergency || false,
            factoryId: finalTargetFactoryId, // Có dữ liệu cho cả Import và Export
            supplierId: values.supplierId,
            details: selectedItems.map((item) => ({
                itemId: item.itemId!, 
                quantity: item.quantity, 
                inputUnit: item.selectedUnit, 
                inputQuantity: item.inputQuantity,
                fromLocationId: item.fromLocationId || null, 
                toLocationId: item.toLocationId || null, 
                usageCategoryId: item.usageCategoryId || null,
            })),
        }
      };

      const res = await axiosClient.post("/tickets", payload);
      
      notification.success({ 
          message: "Tạo phiếu thành công", 
          description: `Mã phiếu: ${res.data.data.code}. Trạng thái: ${res.data.data.status}` 
      });

      form.resetFields(); setSelectedItems([]); setRowLocationOptions({}); setDetectedFactory(null);
      form.setFieldsValue({ type: "IMPORT", isEmergency: false });
    } catch (error: any) {
      notification.error({ message: "Lỗi", description: error.response?.data?.message || "Lỗi không xác định" });
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: "Vật tư", dataIndex: "itemId", width: "28%",
      render: (_: any, record: TransactionDetail) => (
            <Select
              showSearch style={{ width: "100%" }} placeholder="Chọn vật tư..." optionFilterProp="children"
              onChange={(v) => updateRow(record.key, "itemId", v)} value={record.itemId}
              options={items.map((i) => ({ value: i.id, label: `[${i.itemCode}] ${i.itemName}` }))}
              filterOption={(input, option) => (option?.label ?? "").toLowerCase().includes(input.toLowerCase())}
            />
      ),
    },
    {
        title: "Số lượng & ĐVT", dataIndex: "inputQuantity", width: "18%",
        render: (_: any, record: TransactionDetail) => {
            const itemInfo = items.find((i) => i.id === record.itemId);
            const unitOptions = itemInfo ? [{ value: itemInfo.baseUnit, label: itemInfo.baseUnit }, ...(itemInfo.conversions?.map(c => ({ value: c.unitName, label: c.unitName })) || [])] : [];
            return (
                <Input.Group compact>
                    <InputNumber style={{ width: '60%' }} min={0.1} value={record.inputQuantity} onChange={(v) => updateRow(record.key, 'inputQuantity', v)} />
                    <Select style={{ width: '40%' }} value={record.selectedUnit} onChange={(v) => updateRow(record.key, 'unitChange', v)} options={unitOptions} disabled={!record.itemId} />
                </Input.Group>
            )
        }
    },
    {
      title: "Tổng", width: "10%", align: "center" as const,
      render: (_: any, record: TransactionDetail) => {
        const itemInfo = items.find((i) => i.id === record.itemId);
        return <div className="text-gray-500 font-semibold">{record.quantity} {itemInfo?.baseUnit}</div>;
      },
    },
    {
        title: "Mục đích", dataIndex: "usageCategoryId", width: "15%",
        render: (_: any, record: TransactionDetail) => (
          <Select
            style={{ width: "100%" }} placeholder="VD: 11020..." value={record.usageCategoryId}
            onChange={(v) => updateRow(record.key, "usageCategoryId", v)}
            options={usageCategories.map((u) => ({ value: u.id, label: `${u.code}` }))} showSearch allowClear
          />
        ),
    },
    {
      title: "Kho Nguồn (Xuất)", dataIndex: "fromLocationId", className: transactionType === "IMPORT" ? "hidden-col" : "", width: "25%",
      render: (_: any, record: TransactionDetail) => {
        const available = getAvailableStockForLine(record);
        const selectedItemInfo = items.find((i) => i.id === record.itemId);
        return (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <Select
                    style={{ width: "100%" }} placeholder={record.itemId ? "Chọn vị trí có hàng..." : "--"}
                    disabled={transactionType === "IMPORT" || !record.itemId}
                    value={record.fromLocationId} onChange={(v) => updateRow(record.key, "fromLocationId", v)}
                    options={rowLocationOptions[record.key] || []}
                    onDropdownVisibleChange={(open) => {
                        if (open && (!rowLocationOptions[record.key] || rowLocationOptions[record.key].length === 0) && record.itemId) {
                            fetchStockLocationsForItem(record.key, record.itemId);
                        }
                    }}
                    loading={!rowLocationOptions[record.key] && !!record.itemId}
                />
                {record.fromLocationId && (
                    <div className="flex justify-between mt-1 text-xs">
                        <span className="text-gray-500">Tại: {record.sourceFactoryName}</span>
                        <span style={{ color: available < record.quantity ? "red" : "green", marginLeft: '5px' }}>
                            Khả dụng: <b>{available}</b> {selectedItemInfo?.baseUnit}
                        </span>
                    </div>
                )}
            </div>
        );
      },
    },
    {
        title: "Kho Đích", dataIndex: "toLocationId", className: transactionType === "EXPORT" ? "hidden-col" : "",
        render: (_: any, record: TransactionDetail) => (
          <Select
            style={{ width: "100%" }} placeholder="Chọn vị trí..." disabled={transactionType === "EXPORT"}
            value={record.toLocationId} onChange={(v) => updateRow(record.key, "toLocationId", v)}
            options={locations.map((l) => ({ value: l.id, label: l.locationCode }))} showSearch
          />
        ),
    },
    {
      title: "", width: "50px",
      render: (_: any, record: TransactionDetail) => (
        <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeRow(record.key)} />
      ),
    },
  ].filter((col) => !col.className?.includes("hidden-col"));

  const getProcessDescription = () => {
    switch (transactionType) {
        case "IMPORT": return <span className="text-green-600 font-semibold">Tự động duyệt & Cộng tồn kho ngay lập tức.</span>;
        case "TRANSFER": return "1. Trừ kho nguồn ngay lập tức \u2192 2. Kho đích xác nhận để cộng kho.";
        case "EXPORT": return "Quy trình duyệt sẽ thực hiện theo Workflow bạn đã chọn.";
        default: return "";
    }
  };

  return (
    <div style={{ padding: "24px", background: "#f5f7fa", minHeight: "100vh" }}>
        <QRScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onScanSuccess={handleScanSuccess} />
        
        <Card bordered={false} style={{ borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
            <div style={{ marginBottom: "24px", borderBottom: "1px solid #f0f0f0", paddingBottom: "16px" }}>
                <Title level={4} style={{ margin: 0, color: "#1f1f1f" }}>
                    <SwapOutlined style={{ color: "#1890ff", marginRight: "8px" }} /> Tạo Phiếu Giao Dịch Kho
                </Title>
            </div>

            <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ type: "IMPORT", isEmergency: false }}>
                <Row gutter={24}>
                    <Col xs={24} md={6}>
                        <Form.Item name="type" label="Loại giao dịch" rules={[{ required: true }]}>
                            <Select size="large" onChange={handleTypeChange}>
                                <Select.Option value="IMPORT">🟢 NHẬP KHO</Select.Option>
                                <Select.Option value="EXPORT">🔴 XUẤT KHO</Select.Option>
                                <Select.Option value="TRANSFER">🔵 ĐIỀU CHUYỂN</Select.Option>
                            </Select>
                        </Form.Item>
                    </Col>
                    
                    {/* [FIXED] LUÔN HIỂN THỊ Ô CHỌN QUY TRÌNH CHO CẢ NHẬP VÀ XUẤT */}
                    <Col xs={24} md={6}>
                        <Form.Item 
                            name="workflowId" 
                            label={<Space><NodeIndexOutlined className="text-blue-500" /> Quy trình xử lý</Space>} 
                            rules={[{ required: true, message: "Bắt buộc chọn quy trình" }]} 
                            help={availableWorkflows.length === 0 ? "Không tìm thấy quy trình phù hợp. Hãy tạo quy trình mới trong Admin." : ""}
                        >
                            <Select size="large" placeholder="Chọn quy trình...">
                                {availableWorkflows.map((wf) => (
                                    <Select.Option key={wf.id} value={wf.id}>{wf.name}</Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>
                    
                    {transactionType !== "EXPORT" && (
                      <Col xs={24} md={6}>
                        <Form.Item name="supplierId" label={transactionType === "IMPORT" ? "Nhà cung cấp" : "Đối tác (Tùy chọn)"} rules={[{ required: transactionType === "IMPORT", message: "Vui lòng chọn NCC!" }]}>
                          <Select size="large" allowClear placeholder="Chọn..." options={suppliers.map((s) => ({ value: s.id, label: s.name }))} suffixIcon={<ShopOutlined />} />
                        </Form.Item>
                      </Col>
                    )}

                    <Col xs={24} md={8}>
                        <Form.Item name="description" label="Diễn giải / Lý do" rules={[{ required: true, message: "Vui lòng nhập lý do" }]}>
                            <Input size="large" placeholder="Vd: Nhập hàng mới / Xuất thay thế..." />
                        </Form.Item>
                    </Col>
                </Row>

                {detectedFactory && (
                    <Alert 
                        message={<span>Hệ thống nhận diện phiếu này thuộc về: <b className="text-blue-700">{detectedFactory.name}</b></span>}
                        description="Phiếu sẽ được gửi đến bộ phận kho tại nhà máy này để xử lý."
                        type="info" showIcon className="mb-4 border-blue-200 bg-blue-50"
                    />
                )}

                <Divider orientation={"left" as any}>Chi tiết vật tư</Divider>

                <Table dataSource={selectedItems} columns={columns} pagination={false} rowKey="key" bordered 
                    footer={() => (
                        <div className="flex gap-4">
                            <Button type="dashed" onClick={addRow} icon={<PlusOutlined />}>Thêm dòng</Button>
                            <Button type="primary" onClick={() => setIsScannerOpen(true)} icon={<QrcodeOutlined />}>Quét QR</Button>
                        </div>
                    )}
                />
                
                <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ background: "#e6f7ff", border: "1px solid #91d5ff", padding: "8px 12px", borderRadius: "6px", display: "flex", alignItems: "center", gap: "8px" }}>
                            <InfoCircleOutlined style={{ color: "#1890ff" }} />
                            <Text>{getProcessDescription()}</Text>
                        </div>
                    </div>
                    <Button size="large" onClick={() => navigate(-1)}>Hủy bỏ</Button>
                    <Button type="primary" htmlType="submit" size="large" icon={<SendOutlined />} loading={loading}>
                        {transactionType === "IMPORT" ? "Nhập kho ngay" : "Gửi Yêu Cầu"}
                    </Button>
                </div>
            </Form>
        </Card>
    </div>
  );
};

export default StockTransactionCreate;