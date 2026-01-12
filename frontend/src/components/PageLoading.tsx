import { Loading } from "./Loading";

export function PageLoading() {
    return (
        <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Loading />
        </div>
    );
}

export default PageLoading;
