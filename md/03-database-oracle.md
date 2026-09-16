# Database — Oracle Package/Procedure Integration

## Bối cảnh

Team DBA/BA sẽ viết sẵn **package và procedure** trong Oracle chứa logic nghiệp vụ (tính KPI, tổng hợp báo cáo...).
AI code backend **không được tự sáng tác hay sửa đổi logic PL/SQL này**. Nhiệm vụ của backend chỉ là:
gọi đúng procedure, truyền đúng tham số, và map dữ liệu trả về.

## Driver

- Dùng `oracledb` (node-oracledb) bản mới nhất hỗ trợ Thin mode (không cần cài Oracle Instant Client) nếu phù hợp
  với version DB; nếu DB dùng tính năng cần Thick mode thì mới cấu hình Instant Client.
- Kết nối qua **connection pool**, không dùng single connection cho production.

```ts
// database/oracle.service.ts (rút gọn ý tưởng)
import oracledb from 'oracledb';

@Injectable()
export class OracleService implements OnModuleInit, OnApplicationShutdown {
  private pool: oracledb.Pool;

  async onModuleInit() {
    this.pool = await oracledb.createPool({
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectString: `${process.env.ORACLE_HOST}:${process.env.ORACLE_PORT}/${process.env.ORACLE_SERVICE_NAME}`,
      poolMin: Number(process.env.ORACLE_POOL_MIN ?? 2),
      poolMax: Number(process.env.ORACLE_POOL_MAX ?? 10),
    });
  }

  async executeProcedure(pkg: string, proc: string, binds: Record<string, any>) {
    const conn = await this.pool.getConnection();
    try {
      const result = await conn.execute(
        `BEGIN ${pkg}.${proc}(${Object.keys(binds).map(k => `${k} => :${k}`).join(', ')}); END;`,
        binds,
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      return result;
    } finally {
      await conn.close();
    }
  }

  async onApplicationShutdown() {
    await this.pool?.close(10);
  }
}
```

## Nhận dữ liệu trả về

Procedure thường trả dữ liệu qua 1 trong các dạng:

1. **REF CURSOR (OUT param)** — phổ biến nhất cho bảng dữ liệu/danh sách.
   ```ts
   const binds = {
     p_from_date: filter.fromDate,
     p_cursor: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR },
   };
   const result = await conn.execute(sql, binds);
   const rs = result.outBinds.p_cursor;
   const rows = await rs.getRows(numRows); // hoặc loop toàRow
   await rs.close();
   ```
2. **OUT scalar params** — cho giá trị đơn (tổng, đếm...).
3. **Function trả trực tiếp giá trị** — gọi qua `:result := PKG.FUNC(...)`.

> Luôn hỏi rõ team DBA/BA: procedure trả cursor hay OUT param, tên tham số chính xác, kiểu dữ liệu, và có
> ném exception (RAISE_APPLICATION_ERROR) khi lỗi nghiệp vụ hay không — để backend bắt đúng.

## Mapping dữ liệu

- Cột Oracle trả về thường là UPPER_CASE hoặc SNAKE_CASE → luôn có 1 hàm mapper chuyển sang camelCase chuẩn JSON,
  đặt cạnh Service tương ứng, KHÔNG trả thẳng raw row cho FE.

```ts
function mapRevenueRow(row: any) {
  return {
    departmentCode: row.DEPT_CODE,
    departmentName: row.DEPT_NAME,
    revenue: Number(row.REVENUE ?? 0),
    month: row.REPORT_MONTH,
  };
}
```

- Chú ý kiểu dữ liệu: `NUMBER` từ Oracle có thể trả về dạng string tuỳ cấu hình driver — ép kiểu rõ ràng khi map.
- `DATE`/`TIMESTAMP` nên format ISO string thống nhất trước khi trả FE.

## Sổ tay tra cứu procedure (nên duy trì)

Tạo 1 file `docs/db-catalog.md` (riêng, do BA/DBA cập nhật) liệt kê: tên package, tên procedure, mô tả nghiệp vụ,
danh sách tham số IN/OUT, kiểu dữ liệu, ví dụ output. AI nên **tham chiếu file này trước khi viết Service mới**,
không đoán tên tham số.

## Bảo mật

- Không log giá trị tham số nhạy cảm (nếu có dữ liệu cá nhân/lương...) ra log thường.
- User kết nối Oracle của backend nên là user riêng, chỉ có quyền EXECUTE trên các package cần thiết
  (không cấp quyền DML/DDL trực tiếp trên bảng nếu không cần).
