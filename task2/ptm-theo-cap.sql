-- Chạy bằng tài khoản NBH_CDS_NEW hoặc tài khoản có quyền CREATE ANY PROCEDURE.
-- Proc độc lập để không phải biên dịch lại toàn bộ PACK_BR đang vận hành.
-- Cấp 1: toàn viễn thông tỉnh; cấp 2: đơn vị quản lý địa bàn;
-- cấp 3: nhân viên kỹ thuật (MANV_KT/TENNV_KT) trong từng đơn vị địa bàn.
CREATE OR REPLACE PROCEDURE NBH_CDS_NEW.TONGHOP_PTM_CAP (
    P_FROM    IN VARCHAR2,
    P_TO      IN VARCHAR2,
    P_DONVI   IN NUMBER,
    P_CAP     IN NUMBER,
    P_DICHVU  IN NUMBER,
    P_LOAITB  IN NUMBER,
    P_CURSOR  OUT SYS_REFCURSOR
)
IS
    V_TUNGAY DATE;
    V_DENNGAY DATE;
BEGIN
    IF P_CAP IS NULL OR P_CAP NOT IN (1, 2, 3) THEN
        RAISE_APPLICATION_ERROR(-20001, 'P_CAP phai la 1, 2 hoac 3');
    END IF;

    V_TUNGAY := TO_DATE(P_FROM, 'YYYYMMDD');
    V_DENNGAY := TO_DATE(P_TO, 'YYYYMMDD');
    IF V_TUNGAY > V_DENNGAY THEN
        RAISE_APPLICATION_ERROR(-20002, 'Tu ngay khong duoc lon hon den ngay');
    END IF;

    OPEN P_CURSOR FOR
        SELECT
            CASE WHEN P_CAP = 1 THEN 'Viễn thông Gia Lai'
                 ELSE NVL(TEN_DV_QLDB, 'Chưa xác định địa bàn') END AS "Tên đơn vị địa bàn",
            CASE WHEN P_CAP = 3 THEN MANV_KT END AS "Mã nhân viên",
            CASE WHEN P_CAP = 3 THEN NVL(TENNV_KT, 'Chưa xác định nhân viên') END AS "Tên nhân viên",
            SUM(CASE WHEN DICHVUVT_ID IN (1, 10, 11) THEN 1 ELSE 0 END) AS "Cố Định",
            SUM(CASE WHEN LOAITB_ID = 58 THEN 1 ELSE 0 END) AS "Fiber",
            SUM(CASE WHEN LOAITB_ID = 61 THEN 1 ELSE 0 END) AS "Mytv",
            SUM(CASE WHEN LOAITB_ID = 210 THEN 1 ELSE 0 END) AS "Mesh",
            SUM(CASE WHEN DICHVUVT_ID IN (7, 8, 9) THEN 1 ELSE 0 END) AS "TSL",
            SUM(CASE WHEN DICHVUVT_ID = 12 THEN 1 ELSE 0 END) AS "Camera",
            SUM(CASE WHEN DICHVUVT_ID IN (13, 14, 15, 16) THEN 1 ELSE 0 END) AS "Nhóm CNTT"
        FROM DB_PTM
        WHERE NGAY_HT >= V_TUNGAY
          AND NGAY_HT < V_DENNGAY + 1
          AND (P_DONVI = 0 OR DONVI_DB = P_DONVI)
          AND (P_DICHVU = 0 OR DICHVUVT_ID = P_DICHVU)
          AND (P_LOAITB = 0 OR LOAITB_ID = P_LOAITB)
        GROUP BY
            CASE WHEN P_CAP = 1 THEN 0 ELSE DONVI_DB END,
            CASE WHEN P_CAP = 1 THEN 'Viễn thông Gia Lai'
                 ELSE NVL(TEN_DV_QLDB, 'Chưa xác định địa bàn') END,
            CASE WHEN P_CAP = 3 THEN MANV_KT END,
            CASE WHEN P_CAP = 3 THEN NVL(TENNV_KT, 'Chưa xác định nhân viên') END
        ORDER BY "Tên đơn vị địa bàn", "Tên nhân viên", "Mã nhân viên";
END TONGHOP_PTM_CAP;
/

-- Nếu backend kết nối bằng schema khác, DBA cần cấp EXECUTE cho schema đó:
-- GRANT EXECUTE ON NBH_CDS_NEW.TONGHOP_PTM_CAP TO <BACKEND_SCHEMA>;
