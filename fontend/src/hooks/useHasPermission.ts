/**
 * Hook kiểm tra quyền hạn của người dùng hiện tại
 * Sử dụng mảng permissions đã được lưu trong localStorage khi Login
 */
export const useHasPermission = () => {
  const hasPermission = (permissionId: string): boolean => {
    const permsRaw = localStorage.getItem('permissions');
    const userRaw = localStorage.getItem('user');
    
    // Parse dữ liệu an toàn
    let permissions: string[] = [];
    let user: any = null;

    try {
      permissions = permsRaw ? JSON.parse(permsRaw) : [];
      user = userRaw ? JSON.parse(userRaw) : null;
    } catch (e) {
      return false;
    }

    // 1. Nếu là Admin tối cao (ROLE-ADMIN) thì luôn trả về true (Full quyền)
    // Kiểm tra cả roleId trực tiếp và role.id để đảm bảo chính xác
    if (user?.roleId === 'ROLE-ADMIN' || user?.role?.id === 'ROLE-ADMIN') {
      return true;
    }

    // 2. Kiểm tra xem mã quyền có nằm trong danh sách đã được cấp không
    // (Danh sách này đã bao gồm quyền của Role + quyền đặc biệt cá nhân)
    return permissions.includes(permissionId);
  };

  return { hasPermission };
};